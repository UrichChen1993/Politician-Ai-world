import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { buildDecisionPrompt } = await import("../convex/lib/decisionPrompt.ts");
const { AGENTS, BILL } = await import("../convex/lib/seedData.ts");

const groundTruth = JSON.parse(
  readFileSync(new URL("../data/ground-truth.json", import.meta.url), "utf8"),
);

test("prompt includes persona, bill title, and article text", () => {
  const agent = AGENTS[0];
  const { system, user } = buildDecisionPrompt(agent, BILL);
  assert.ok(user.includes(agent.name), "user prompt names the agent");
  assert.ok(user.includes(agent.persona), "user prompt carries the persona");
  assert.ok(user.includes(BILL.title), "user prompt carries the bill title");
  assert.ok(
    user.includes(BILL.articles[0].text),
    "user prompt carries article text",
  );
  assert.ok(
    system.toLowerCase().includes("json"),
    "system prompt demands JSON output",
  );
});

test("system prompt forbids relying on memorized historical votes", () => {
  const { system } = buildDecisionPrompt(AGENTS[0], BILL);
  assert.ok(system.includes("記憶") || system.includes("歷史"));
});

test("LEAKAGE GUARD: prompt never contains voting-day publicReasoning", () => {
  const reasoningByRef = new Map(
    groundTruth.actualVotes.map((v) => [v.agentId, v.publicReasoning]),
  );
  for (const agent of AGENTS) {
    const { system, user } = buildDecisionPrompt(agent, BILL);
    const full = `${system}\n${user}`;
    const reasoning = reasoningByRef.get(agent.profileRef);
    assert.ok(reasoning, `ground truth reasoning exists for ${agent.profileRef}`);
    assert.ok(
      !full.includes(reasoning),
      `prompt for ${agent.name} leaks publicReasoning`,
    );
  }
});

test("LEAKAGE GUARD: no answer-revealing phrases appear in any prompt", () => {
  const leakPhrases = [
    "從政初衷",
    "700多萬",
    "幸福美滿",
    "社會撕裂",
    "寧願被黨紀罰款",
    "投反對票",
    "投贊成票",
  ];
  for (const agent of AGENTS) {
    const { system, user } = buildDecisionPrompt(agent, BILL);
    const full = `${system}${user}`;
    for (const phrase of leakPhrases) {
      assert.ok(
        !full.includes(phrase),
        `prompt for ${agent.name} leaks phrase: ${phrase}`,
      );
    }
  }
});
