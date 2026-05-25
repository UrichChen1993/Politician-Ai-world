import test from "node:test";
import assert from "node:assert/strict";

// We test the pure handler functions extracted from Convex query wrappers,
// similar to how simulationCore and seed tests mock ctx.db.

const { listAgentsHandler, listBillsHandler, listBillVotesHandler, listLlmCallLogHandler } =
  await import("../convex/lib/queryHandlers.ts");

// --- listAgents ---

test("listAgentsHandler returns all agents from db", async () => {
  const agents = [
    { _id: "a1", name: "王立委", factionId: "blue" },
    { _id: "a2", name: "李議員", factionId: "green" },
  ];
  const ctx = { db: { query: () => ({ collect: async () => agents }) } };

  const result = await listAgentsHandler(ctx);
  assert.equal(result.length, 2);
  assert.equal(result[0].name, "王立委");
  assert.equal(result[1].factionId, "green");
});

test("listAgentsHandler returns empty array when no agents", async () => {
  const ctx = { db: { query: () => ({ collect: async () => [] }) } };
  const result = await listAgentsHandler(ctx);
  assert.deepEqual(result, []);
});

// --- listBills ---

test("listBillsHandler returns all bills from db", async () => {
  const bills = [
    { _id: "b1", number: "POC-001", title: "Test Bill", status: "voting" },
  ];
  const ctx = { db: { query: () => ({ collect: async () => bills }) } };

  const result = await listBillsHandler(ctx);
  assert.equal(result.length, 1);
  assert.equal(result[0].number, "POC-001");
  assert.equal(result[0].status, "voting");
});

// --- listBillVotes ---

test("listBillVotesHandler returns all billVotes from db", async () => {
  const votes = [
    { _id: "v1", agentId: "a1", vote: "yes", reasoning: "agreed" },
    { _id: "v2", agentId: "a2", vote: "no", reasoning: "disagreed" },
  ];
  const ctx = { db: { query: () => ({ collect: async () => votes }) } };

  const result = await listBillVotesHandler(ctx);
  assert.equal(result.length, 2);
  assert.equal(result[0].vote, "yes");
  assert.equal(result[1].vote, "no");
});

test("listBillVotesHandler returns empty array when no votes", async () => {
  const ctx = { db: { query: () => ({ collect: async () => [] }) } };
  const result = await listBillVotesHandler(ctx);
  assert.deepEqual(result, []);
});

// --- listLlmCallLog ---

test("listLlmCallLogHandler returns all llmCallLog entries", async () => {
  const logs = [
    { _id: "l1", costUsd: 0.01 },
    { _id: "l2", costUsd: 0.02 },
  ];
  const ctx = { db: { query: () => ({ collect: async () => logs }) } };

  const result = await listLlmCallLogHandler(ctx);
  assert.equal(result.length, 2);
  assert.equal(result[0].costUsd, 0.01);
});

test("listLlmCallLogHandler returns empty array (Phase A)", async () => {
  const ctx = { db: { query: () => ({ collect: async () => [] }) } };
  const result = await listLlmCallLogHandler(ctx);
  assert.deepEqual(result, []);
});
