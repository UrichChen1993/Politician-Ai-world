import test from "node:test";
import assert from "node:assert/strict";

const { estimateCostUsd } = await import("../convex/lib/llm/cost.ts");

test("estimateCostUsd: Haiku 4.5 input+output rate", () => {
  // 6000 in × $0.80/M + 500 out × $4.00/M = 0.0048 + 0.0020 = 0.0068
  assert.equal(
    estimateCostUsd("claude-haiku-4-5-20251001", 6000, 500),
    0.0068,
  );
});

test("estimateCostUsd: DeepSeek rate", () => {
  // 6000 × $0.27/M + 500 × $1.10/M = 0.00162 + 0.00055 = 0.00217
  assert.equal(estimateCostUsd("deepseek-chat", 6000, 500), 0.00217);
});

test("estimateCostUsd: zero tokens → 0", () => {
  assert.equal(estimateCostUsd("claude-haiku-4-5-20251001", 0, 0), 0);
});

test("estimateCostUsd: unknown model → 0 (never throws)", () => {
  assert.equal(estimateCostUsd("some-unlisted-model", 6000, 500), 0);
});
