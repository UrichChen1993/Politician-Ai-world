import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const schemaPath = new URL("../convex/schema.ts", import.meta.url);

async function schemaSource() {
  return await readFile(schemaPath, "utf8");
}

test("Convex schema defines the core PoC tables with required fields", async () => {
  const source = await schemaSource();

  for (const table of ["agents", "bills", "sessions", "billVotes", "llmCallLog"]) {
    assert.match(source, new RegExp(`${table}:\\s*defineTable\\(`));
  }

  for (const field of [
    "name",
    "profileRef",
    "factionId",
    "opinionState",
    "number",
    "title",
    "articles",
    "startedAt",
    "endedAt",
    "seed",
    "billsInScope",
    "sessionId",
    "billId",
    "agentId",
    "reasoning",
    "llmCallId",
    "action",
    "model",
    "promptTokens",
    "completionTokens",
    "costUsd",
    "latencyMs",
    "ok",
    "errorKind",
  ]) {
    assert.match(source, new RegExp(`${field}:\\s*v\\.`));
  }

  assert.match(source, /const stanceVector\s*=\s*v\.object\(/);
  assert.match(source, /economic:\s*v\.number\(\)/);
  assert.match(source, /environment:\s*v\.number\(\)/);
  assert.match(source, /social:\s*v\.number\(\)/);
  assert.match(source, /stanceVector,?/);
  assert.match(source, /status:\s*billStatus/);
  assert.match(source, /vote,?/);
});

test("Convex schema constrains enums and creates future placeholder tables", async () => {
  const source = await schemaSource();

  for (const status of ["introduced", "in_committee", "voting", "passed", "rejected"]) {
    assert.match(source, new RegExp(`v\\.literal\\("${status}"\\)`));
  }

  for (const vote of ["yes", "no", "abstain"]) {
    assert.match(source, new RegExp(`v\\.literal\\("${vote}"\\)`));
  }

  for (const table of ["mediaOutlets", "newsItems", "externalEvents"]) {
    assert.match(source, new RegExp(`${table}:\\s*defineTable\\(`));
  }
});
