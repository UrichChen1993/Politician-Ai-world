import test from "node:test";
import assert from "node:assert/strict";

const { checkReferences } = await import("../convex/lib/referenceCheck.ts");

test("no hallucination when all cited articles exist", () => {
  assert.deepEqual(checkReferences([2, 4], [2, 4, 20, 24, 26]).hallucinated, []);
});

test("flags article numbers absent from the bill", () => {
  assert.deepEqual(checkReferences([4, 99], [2, 4, 20]).hallucinated, [99]);
});

test("empty citations never hallucinate", () => {
  assert.deepEqual(checkReferences([], [2, 4]).hallucinated, []);
});

test("deduplicates repeated hallucinated references", () => {
  assert.deepEqual(checkReferences([99, 99, 7], [2]).hallucinated, [99, 7]);
});
