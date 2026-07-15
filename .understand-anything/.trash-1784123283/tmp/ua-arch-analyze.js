// Structural analysis for architecture-analyzer Phase 1.
const fs = require('fs');

function fail(msg) { console.error(msg); process.exit(1); }

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) fail('usage: node ua-arch-analyze.js <input.json> <output.json>');

let input;
try {
  input = JSON.parse(fs.readFileSync(inPath, 'utf8'));
} catch (e) {
  fail('failed to read/parse input: ' + e.message);
}

const fileNodes = input.fileNodes || [];
const importEdges = input.importEdges || [];
const allEdges = input.allEdges || [];

const nodeById = new Map(fileNodes.map(n => [n.id, n]));

// --- A. Directory grouping ---
function dirOf(p) {
  const parts = p.split('/');
  return parts.length > 1 ? parts.slice(0, -1) : [];
}

const paths = fileNodes.map(n => n.filePath || n.name || '');
function commonPrefixSegments(paths) {
  if (paths.length === 0) return [];
  const segLists = paths.map(p => p.split('/').slice(0, -1));
  const min = Math.min(...segLists.map(s => s.length));
  const prefix = [];
  for (let i = 0; i < min; i++) {
    const seg = segLists[0][i];
    if (segLists.every(s => s[i] === seg)) prefix.push(seg);
    else break;
  }
  return prefix;
}
const commonPrefix = commonPrefixSegments(paths);

function groupKeyFor(node) {
  const p = node.filePath || node.name || '';
  const segs = p.split('/').slice(0, -1);
  const rest = segs.slice(commonPrefix.length);
  if (rest.length > 0) return rest[0];
  if (segs.length > 0) return segs[segs.length - 1];
  // flat file at prefix root (or fully flat project) -> group by extension/pattern
  const base = p.split('/').pop() || '';
  if (/\.(test|spec)\./.test(base)) return 'test';
  if (/\.config\./.test(base)) return 'config';
  const m = base.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1] : 'root';
}

const directoryGroups = {};
for (const n of fileNodes) {
  const key = groupKeyFor(n);
  (directoryGroups[key] = directoryGroups[key] || []).push(n.id);
}

// --- B. Node type grouping ---
const nodeTypeGroups = {};
for (const n of fileNodes) {
  (nodeTypeGroups[n.type] = nodeTypeGroups[n.type] || []).push(n.id);
}

// --- C. Import adjacency + fan in/out ---
const fileFanIn = {};
const fileFanOut = {};
for (const n of fileNodes) { fileFanIn[n.id] = 0; fileFanOut[n.id] = 0; }
for (const e of importEdges) {
  if (fileFanOut[e.source] !== undefined) fileFanOut[e.source]++;
  if (fileFanIn[e.target] !== undefined) fileFanIn[e.target]++;
}

function groupOf(id) {
  for (const [g, ids] of Object.entries(directoryGroups)) if (ids.includes(id)) return g;
  return null;
}

// --- D. Cross-category dependency analysis ---
const crossCategoryMap = new Map();
for (const e of allEdges) {
  const s = nodeById.get(e.source), t = nodeById.get(e.target);
  if (!s || !t) continue;
  if (s.type === t.type && importEdges.some(ie => ie.source === e.source && ie.target === e.target)) continue;
  const key = `${s.type}|${t.type}|${e.type}`;
  crossCategoryMap.set(key, (crossCategoryMap.get(key) || 0) + 1);
}
const crossCategoryEdges = [...crossCategoryMap.entries()].map(([k, count]) => {
  const [fromType, toType, edgeType] = k.split('|');
  return { fromType, toType, edgeType, count };
});

// --- E. Inter-group import frequency (import edges only) ---
const interGroupMap = new Map();
for (const e of importEdges) {
  const g1 = groupOf(e.source), g2 = groupOf(e.target);
  if (!g1 || !g2 || g1 === g2) continue;
  const key = `${g1}|${g2}`;
  interGroupMap.set(key, (interGroupMap.get(key) || 0) + 1);
}
const interGroupImports = [...interGroupMap.entries()].map(([k, count]) => {
  const [from, to] = k.split('|');
  return { from, to, count };
});

// --- F. Intra-group import density ---
const intraGroupDensity = {};
for (const g of Object.keys(directoryGroups)) {
  let internal = 0, total = 0;
  for (const e of importEdges) {
    const g1 = groupOf(e.source), g2 = groupOf(e.target);
    if (g1 === g || g2 === g) {
      total++;
      if (g1 === g && g2 === g) internal++;
    }
  }
  intraGroupDensity[g] = { internalEdges: internal, totalEdges: total, density: total > 0 ? +(internal / total).toFixed(2) : 0 };
}

// --- G. Directory pattern matching ---
const PATTERNS = {
  api: ['routes', 'api', 'controllers', 'endpoints', 'handlers', 'controller', 'routers', 'blueprints', 'serializers'],
  service: ['services', 'core', 'lib', 'domain', 'logic', 'signals', 'internal', 'src/main/java', 'composables', 'mailers', 'jobs', 'channels'],
  data: ['models', 'db', 'data', 'persistence', 'repository', 'entities', 'migrations', 'entity', 'sql', 'database', 'schema'],
  ui: ['components', 'views', 'pages', 'ui', 'layouts', 'screens'],
  middleware: ['middleware', 'plugins', 'interceptors', 'guards'],
  utility: ['utils', 'helpers', 'common', 'shared', 'tools', 'templatetags', 'pkg'],
  config: ['config', 'constants', 'env', 'settings', 'management', 'commands'],
  test: ['__tests__', 'test', 'tests', 'spec', 'specs', 'src/test/java'],
  types: ['types', 'interfaces', 'schemas', 'contracts', 'dtos', 'dto', 'request', 'response'],
  hooks: ['hooks'],
  state: ['store', 'state', 'reducers', 'actions', 'slices'],
  assets: ['assets', 'static', 'public'],
  entry: ['cmd', 'bin'],
  documentation: ['docs', 'documentation', 'wiki'],
  infrastructure: ['deploy', 'deployment', 'infra', 'infrastructure', 'k8s', 'kubernetes', 'helm', 'charts', 'terraform', 'tf', 'docker'],
  'ci-cd': ['.github', '.gitlab', '.circleci'],
};
function matchPattern(dirName) {
  const lower = dirName.toLowerCase();
  for (const [label, names] of Object.entries(PATTERNS)) {
    if (names.includes(lower)) return label;
  }
  return null;
}
const patternMatches = {};
for (const g of Object.keys(directoryGroups)) {
  const m = matchPattern(g);
  if (m) patternMatches[g] = m;
}
// special-case: this project's groups
if (directoryGroups['design']) patternMatches['design'] = 'documentation';
if (directoryGroups['archive']) patternMatches['archive'] = 'documentation';
if (directoryGroups['root']) patternMatches['root'] = 'documentation';

// --- H. Deployment topology ---
const infraFileNames = fileNodes.filter(n => {
  const b = (n.filePath || '').toLowerCase();
  return /dockerfile|docker-compose|\.tf$|\.tfvars$|makefile$/.test(b);
}).map(n => n.filePath);
const ciFiles = fileNodes.filter(n => {
  const b = (n.filePath || '').toLowerCase();
  return /\.github\/workflows|\.gitlab-ci\.yml|jenkinsfile/.test(b);
}).map(n => n.filePath);
const deploymentTopology = {
  hasDockerfile: fileNodes.some(n => /dockerfile/i.test(n.filePath || '')),
  hasCompose: fileNodes.some(n => /docker-compose/i.test(n.filePath || '')),
  hasK8s: fileNodes.some(n => /(^|\/)(k8s|kubernetes|helm|charts)\//i.test(n.filePath || '')),
  hasTerraform: fileNodes.some(n => /\.tf$|\.tfvars$/i.test(n.filePath || '')),
  hasCI: ciFiles.length > 0,
  infraFiles: [...infraFileNames, ...ciFiles],
};

// --- I. Data pipeline detection ---
const dataPipeline = {
  schemaFiles: fileNodes.filter(n => /\.(sql|graphql|gql|proto|prisma)$/i.test(n.filePath || '') || /schema/i.test(n.name || '')).map(n => n.filePath),
  migrationFiles: fileNodes.filter(n => /migrations\//i.test(n.filePath || '')).map(n => n.filePath),
  dataModelFiles: fileNodes.filter(n => (groupOf(n.id) && patternMatches[groupOf(n.id)] === 'data')).map(n => n.filePath),
  apiHandlerFiles: fileNodes.filter(n => (groupOf(n.id) && patternMatches[groupOf(n.id)] === 'api')).map(n => n.filePath),
};

// --- J. Documentation coverage ---
const docNodes = fileNodes.filter(n => n.type === 'document' || /\.md$|\.rst$/i.test(n.filePath || ''));
const groupsWithDocsSet = new Set();
for (const g of Object.keys(directoryGroups)) {
  const hasDoc = directoryGroups[g].some(id => {
    const n = nodeById.get(id);
    return n && (n.type === 'document' || /\.md$|\.rst$/i.test(n.filePath || ''));
  });
  if (hasDoc) groupsWithDocsSet.add(g);
}
const totalGroups = Object.keys(directoryGroups).length;
const docCoverage = {
  groupsWithDocs: groupsWithDocsSet.size,
  totalGroups,
  coverageRatio: totalGroups > 0 ? +(groupsWithDocsSet.size / totalGroups).toFixed(2) : 0,
  undocumentedGroups: Object.keys(directoryGroups).filter(g => !groupsWithDocsSet.has(g)),
};

// --- K. Dependency direction ---
const dependencyDirection = [];
const seenPairs = new Set();
for (const { from, to, count } of interGroupImports) {
  const reverse = interGroupImports.find(x => x.from === to && x.to === from);
  const revCount = reverse ? reverse.count : 0;
  const pairKey = [from, to].sort().join('|');
  if (seenPairs.has(pairKey)) continue;
  seenPairs.add(pairKey);
  if (count > revCount) dependencyDirection.push({ dependent: from, dependsOn: to });
  else if (revCount > count) dependencyDirection.push({ dependent: to, dependsOn: from });
}

// --- fileStats ---
const filesPerGroup = {};
for (const [g, ids] of Object.entries(directoryGroups)) filesPerGroup[g] = ids.length;
const nodeTypeCounts = {};
for (const [t, ids] of Object.entries(nodeTypeGroups)) nodeTypeCounts[t] = ids.length;

const result = {
  scriptCompleted: true,
  directoryGroups,
  nodeTypeGroups,
  crossCategoryEdges,
  interGroupImports,
  intraGroupDensity,
  patternMatches,
  deploymentTopology,
  dataPipeline,
  docCoverage,
  dependencyDirection,
  fileStats: {
    totalFileNodes: fileNodes.length,
    filesPerGroup,
    nodeTypeCounts,
  },
  fileFanIn,
  fileFanOut,
};

try {
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
} catch (e) {
  fail('failed to write output: ' + e.message);
}
console.log('OK, wrote', outPath);
process.exit(0);
