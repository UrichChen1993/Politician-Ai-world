#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) fail('Usage: node ua-tour-analyze.js <input.json> <output.json>');

let data;
try {
  data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (e) {
  fail('Failed to read/parse input: ' + e.message);
}

const nodes = data.nodes || [];
const edges = data.edges || [];
const layers = data.layers || [];

const nodeById = new Map(nodes.map(n => [n.id, n]));

// Fan-in / fan-out
const fanIn = new Map();
const fanOut = new Map();
for (const n of nodes) { fanIn.set(n.id, 0); fanOut.set(n.id, 0); }
for (const e of edges) {
  if (fanOut.has(e.source)) fanOut.set(e.source, fanOut.get(e.source) + 1);
  if (fanIn.has(e.target)) fanIn.set(e.target, fanIn.get(e.target) + 1);
}

const fanInRanking = [...fanIn.entries()]
  .map(([id, v]) => ({ id, fanIn: v, name: nodeById.get(id)?.name }))
  .sort((a, b) => b.fanIn - a.fanIn)
  .slice(0, 20);

const fanOutRanking = [...fanOut.entries()]
  .map(([id, v]) => ({ id, fanOut: v, name: nodeById.get(id)?.name }))
  .sort((a, b) => b.fanOut - a.fanOut)
  .slice(0, 20);

// Entry point candidates
const ENTRY_FILENAMES = new Set([
  'index.ts','index.js','main.ts','main.js','app.ts','app.js','server.ts','server.js',
  'mod.rs','main.go','main.py','main.rs','manage.py','app.py','wsgi.py','asgi.py','run.py',
  '__main__.py','Application.java','Main.java','Program.cs','config.ru','index.php',
  'App.swift','Application.kt','main.cpp','main.c'
]);

const fanOutValues = [...fanOut.values()].sort((a, b) => a - b);
const fanInValues = [...fanIn.values()].sort((a, b) => a - b);
function percentileThreshold(sorted, pct) {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * pct);
  return sorted[Math.min(idx, sorted.length - 1)];
}
const fanOutTop10Threshold = percentileThreshold(fanOutValues, 0.9);
const fanInBottom25Threshold = percentileThreshold(fanInValues, 0.25);

function depthOf(filePath) {
  return filePath.split('/').filter(Boolean).length;
}

const entryScores = [];
for (const n of nodes) {
  let score = 0;
  const fp = n.filePath || '';
  const base = path.basename(fp);
  if (n.type === 'document') {
    const isRoot = depthOf(fp) === 1;
    if (base.toLowerCase() === 'readme.md' && isRoot) score += 5;
    else if (base.toLowerCase().endsWith('.md') && isRoot) score += 2;
  } else {
    if (ENTRY_FILENAMES.has(base)) score += 3;
    if (depthOf(fp) <= 2) score += 1;
    if (fanOut.get(n.id) >= fanOutTop10Threshold && fanOutTop10Threshold > 0) score += 1;
    if (fanIn.get(n.id) <= fanInBottom25Threshold) score += 1;
  }
  if (score > 0) entryScores.push({ id: n.id, score, name: n.name, summary: n.summary });
}
entryScores.sort((a, b) => b.score - a.score);
const entryPointCandidates = entryScores.slice(0, 5);

// BFS from top code entry point (skip documentation nodes for BFS start)
const codeEntryCandidates = entryScores.filter(c => nodeById.get(c.id).type !== 'document');
let bfsStart = codeEntryCandidates.length > 0 ? codeEntryCandidates[0].id : null;

const adjacency = new Map();
for (const n of nodes) adjacency.set(n.id, []);
for (const e of edges) {
  if ((e.type === 'imports' || e.type === 'calls') && adjacency.has(e.source)) {
    adjacency.get(e.source).push(e.target);
  }
}

let bfsTraversal = { startNode: null, order: [], depthMap: {}, byDepth: {} };
if (bfsStart) {
  const visited = new Set([bfsStart]);
  const order = [bfsStart];
  const depthMap = { [bfsStart]: 0 };
  const queue = [bfsStart];
  while (queue.length) {
    const cur = queue.shift();
    const d = depthMap[cur];
    for (const next of (adjacency.get(cur) || [])) {
      if (!visited.has(next)) {
        visited.add(next);
        depthMap[next] = d + 1;
        order.push(next);
        queue.push(next);
      }
    }
  }
  const byDepth = {};
  for (const [id, d] of Object.entries(depthMap)) {
    byDepth[d] = byDepth[d] || [];
    byDepth[d].push(id);
  }
  bfsTraversal = { startNode: bfsStart, order, depthMap, byDepth };
}

// Non-code file inventory
const nonCodeFiles = { documentation: [], infrastructure: [], data: [], config: [] };
for (const n of nodes) {
  const entry = { id: n.id, name: n.name, type: n.type, summary: n.summary };
  if (n.type === 'document') nonCodeFiles.documentation.push(entry);
  else if (['service', 'pipeline', 'resource'].includes(n.type)) nonCodeFiles.infrastructure.push(entry);
  else if (['table', 'schema', 'endpoint'].includes(n.type)) nonCodeFiles.data.push(entry);
  else if (n.type === 'config') nonCodeFiles.config.push(entry);
}

// Tightly coupled clusters
const edgeSet = new Set(edges.map(e => `${e.source}=>${e.target}`));
const bidirectionalPairs = [];
for (const e of edges) {
  if ((e.type === 'imports' || e.type === 'calls' || e.type === 'related' || e.type === 'documents') &&
      edgeSet.has(`${e.target}=>${e.source}`) && e.source < e.target) {
    bidirectionalPairs.push([e.source, e.target]);
  }
}

// Union-find to group bidirectional pairs into clusters, then expand
const parent = new Map(nodes.map(n => [n.id, n.id]));
function find(x) { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; }
function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); }
for (const [a, b] of bidirectionalPairs) union(a, b);

const groups = new Map();
for (const n of nodes) {
  const root = find(n.id);
  if (!groups.has(root)) groups.set(root, new Set());
  groups.get(root).add(n.id);
}

let clusters = [...groups.values()]
  .filter(s => s.size >= 2 && s.size <= 5)
  .map(s => {
    const nodeList = [...s];
    let edgeCount = 0;
    for (const e of edges) {
      if (nodeList.includes(e.source) && nodeList.includes(e.target)) edgeCount++;
    }
    return { nodes: nodeList, edgeCount };
  })
  .sort((a, b) => b.edgeCount - a.edgeCount)
  .slice(0, 10);

// Layers
const layersOut = { count: layers.length, list: layers.map(l => ({ id: l.id, name: l.name, description: l.description })) };

// Node summary index
const nodeSummaryIndex = {};
for (const n of nodes) nodeSummaryIndex[n.id] = { name: n.name, type: n.type, summary: n.summary };

const result = {
  scriptCompleted: true,
  entryPointCandidates,
  fanInRanking,
  fanOutRanking,
  bfsTraversal,
  nonCodeFiles,
  clusters,
  layers: layersOut,
  nodeSummaryIndex,
  totalNodes: nodes.length,
  totalEdges: edges.length
};

try {
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
} catch (e) {
  fail('Failed to write output: ' + e.message);
}

console.log('Analysis complete. Wrote results to ' + outputPath);
process.exit(0);
