import test from "node:test";
import assert from "node:assert/strict";

const { recordDecisionHandler } = await import(
  "../convex/lib/recordDecisionHandler.ts"
);

function fakeDb() {
  const inserts = [];
  let n = 0;
  return {
    inserts,
    insert: async (table, doc) => {
      const id = `${table}_${n++}`;
      inserts.push({ id, table, doc });
      return id;
    },
  };
}

const LLM_CALL = {
  action: "decideVote",
  model: "claude-haiku-4-5-20251001",
  promptTokens: 6000,
  completionTokens: 500,
  costUsd: 0.0068,
  latencyMs: 123,
  ok: true,
};

test("inserts llmCallLog then billVote linked by llmCallId", async () => {
  const db = fakeDb();
  const out = await recordDecisionHandler(
    { db },
    {
      sessionId: "s1",
      billId: "b1",
      agentId: "a1",
      vote: "yes",
      reasoning: "理由",
      llmCall: LLM_CALL,
    },
  );

  const log = db.inserts.find((i) => i.table === "llmCallLog");
  const vote = db.inserts.find((i) => i.table === "billVotes");
  assert.ok(log, "llmCallLog inserted");
  assert.equal(log.doc.ok, true);
  assert.equal(log.doc.costUsd, 0.0068);
  assert.equal(vote.doc.vote, "yes");
  assert.equal(vote.doc.llmCallId, log.id, "billVote links to the llmCallLog id");
  assert.equal(out.llmCallId, log.id);
});

test("omits errorKind when undefined, includes it when present", async () => {
  const db1 = fakeDb();
  await recordDecisionHandler(
    { db: db1 },
    { sessionId: "s", billId: "b", agentId: "a", vote: "no", reasoning: "r", llmCall: LLM_CALL },
  );
  const log1 = db1.inserts.find((i) => i.table === "llmCallLog");
  assert.ok(!("errorKind" in log1.doc));

  const db2 = fakeDb();
  await recordDecisionHandler(
    { db: db2 },
    {
      sessionId: "s",
      billId: "b",
      agentId: "a",
      vote: "no",
      reasoning: "r",
      llmCall: { ...LLM_CALL, ok: false, errorKind: "timeout" },
    },
  );
  const log2 = db2.inserts.find((i) => i.table === "llmCallLog");
  assert.equal(log2.doc.errorKind, "timeout");
});
