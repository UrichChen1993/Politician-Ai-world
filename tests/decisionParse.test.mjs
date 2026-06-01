import test from "node:test";
import assert from "node:assert/strict";

const { parseDecisionResponse, DecisionParseError } = await import(
  "../convex/lib/decisionParse.ts"
);

test("parses a clean JSON object", () => {
  const out = parseDecisionResponse(
    '{"vote":"yes","reasoning":"立場相符","citedArticles":[2,4]}',
  );
  assert.deepEqual(out, {
    vote: "yes",
    reasoning: "立場相符",
    citedArticles: [2, 4],
  });
});

test("strips ```json fences", () => {
  const raw = '```json\n{"vote":"no","reasoning":"反對","citedArticles":[]}\n```';
  assert.equal(parseDecisionResponse(raw).vote, "no");
});

test("tolerates surrounding prose by extracting the JSON object", () => {
  const raw =
    'Here is my answer: {"vote":"abstain","reasoning":"棄權","citedArticles":[]} done.';
  assert.equal(parseDecisionResponse(raw).vote, "abstain");
});

test("coerces numeric-string citedArticles to numbers", () => {
  const out = parseDecisionResponse(
    '{"vote":"yes","reasoning":"ok","citedArticles":["4","2"]}',
  );
  assert.deepEqual(out.citedArticles, [4, 2]);
});

test("missing citedArticles defaults to empty array", () => {
  const out = parseDecisionResponse('{"vote":"yes","reasoning":"ok"}');
  assert.deepEqual(out.citedArticles, []);
});

test("throws DecisionParseError on malformed JSON", () => {
  assert.throws(
    () => parseDecisionResponse("not json at all"),
    DecisionParseError,
  );
});

test("throws on vote outside the enum", () => {
  assert.throws(
    () => parseDecisionResponse('{"vote":"maybe","reasoning":"x"}'),
    DecisionParseError,
  );
});

test("throws on missing/empty reasoning", () => {
  assert.throws(
    () => parseDecisionResponse('{"vote":"yes","reasoning":"  "}'),
    DecisionParseError,
  );
});

test("throws when top-level is not an object", () => {
  assert.throws(() => parseDecisionResponse("[1,2,3]"), DecisionParseError);
});
