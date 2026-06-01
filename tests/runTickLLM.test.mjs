import test from "node:test";
import assert from "node:assert/strict";

const { runTickLLMHandler } = await import("../convex/lib/runTickLLMHandler.ts");

const BILL = {
  _id: "b1",
  number: "n",
  title: "t",
  articles: [{ articleNo: 2, text: "a2" }],
  stanceVector: { economic: 0, environment: 0, social: 0.9 },
};
const AGENTS = [
  { _id: "a1", name: "甲", factionId: "X", persona: "p", stanceVector: { economic: 0, environment: 0, social: 0.9 } }, // dot +0.81
  { _id: "a2", name: "乙", factionId: "Y", persona: "p", stanceVector: { economic: 0, environment: 0, social: -0.9 } }, // dot -0.81
];

function fakePorts() {
  const recorded = [];
  return {
    recorded,
    load: async () => ({ billId: BILL._id, bill: BILL, agents: AGENTS }),
    record: async (d) => recorded.push(d),
  };
}

const okClient = (text) => async () => ({
  text,
  model: "claude-haiku-4-5-20251001",
  promptTokens: 10,
  completionTokens: 2,
});

test("records one decision per agent via LLM", async () => {
  const ports = fakePorts();
  const client = okClient('{"vote":"yes","reasoning":"ok","citedArticles":[2]}');
  const out = await runTickLLMHandler(ports, {
    sessionId: "s1",
    client,
    model: "claude-haiku-4-5-20251001",
  });
  assert.equal(out.decisions, 2);
  assert.equal(out.fallbacks, 0);
  assert.equal(ports.recorded.length, 2);
  assert.equal(ports.recorded[0].vote, "yes");
  assert.equal(ports.recorded[0].llmCall.ok, true);
  assert.equal(ports.recorded[0].billId, "b1");
});

test("counts fallbacks when the LLM keeps failing", async () => {
  const ports = fakePorts();
  const client = okClient("not json"); // every call fails schema validation
  const out = await runTickLLMHandler(ports, {
    sessionId: "s1",
    client,
    model: "claude-haiku-4-5-20251001",
  });
  assert.equal(out.fallbacks, 2);
  // fallback votes follow the dot product: a1 → yes, a2 → no
  assert.equal(ports.recorded[0].vote, "yes");
  assert.equal(ports.recorded[1].vote, "no");
  assert.equal(ports.recorded[0].llmCall.ok, false);
});
