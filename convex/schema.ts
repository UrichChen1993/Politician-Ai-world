import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const stanceVector = v.object({
  economic: v.number(),
  environment: v.number(),
  social: v.number(),
});

const billStatus = v.union(
  v.literal("introduced"),
  v.literal("in_committee"),
  v.literal("voting"),
  v.literal("passed"),
  v.literal("rejected"),
);

const vote = v.union(v.literal("yes"), v.literal("no"), v.literal("abstain"));
const actualVote = v.union(
  v.literal("yes"),
  v.literal("no"),
  v.literal("abstain"),
  v.literal("absent"),
);

export default defineSchema({
  agents: defineTable({
    name: v.string(),
    profileRef: v.string(),
    stanceVector,
    factionId: v.string(),
    opinionState: v.number(),
    // Phase B: leak-free persona injected into the LLM prompt. Encodes party,
    // role, disposition and issue stance as knowable *before* the vote — never
    // the actual vote or voting-day reasoning. Optional so Phase A seeds stay valid.
    persona: v.optional(v.string()),
  }),

  bills: defineTable({
    number: v.string(),
    title: v.string(),
    articles: v.array(
      v.object({
        articleNo: v.number(),
        text: v.string(),
        tags: v.array(v.string()),
      }),
    ),
    stanceVector,
    status: billStatus,
    actualVotes: v.optional(
      v.array(
        v.object({
          agentId: v.string(),
          vote: actualVote,
          sourceUrl: v.string(),
        }),
      ),
    ),
  }),

  sessions: defineTable({
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    seed: v.number(),
    billsInScope: v.array(v.id("bills")),
  }),

  billVotes: defineTable({
    sessionId: v.id("sessions"),
    billId: v.id("bills"),
    agentId: v.id("agents"),
    vote,
    reasoning: v.string(),
    llmCallId: v.optional(v.id("llmCallLog")),
  }),

  llmCallLog: defineTable({
    agentId: v.id("agents"),
    action: v.string(),
    model: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    costUsd: v.number(),
    latencyMs: v.number(),
    ok: v.boolean(),
    errorKind: v.optional(v.string()),
  }),

  mediaOutlets: defineTable({}),
  newsItems: defineTable({}),
  externalEvents: defineTable({}),
});
