import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { recordDecisionHandler } from "./lib/recordDecisionHandler.ts";

export { recordDecisionHandler } from "./lib/recordDecisionHandler.ts";

const llmCallValidator = v.object({
  action: v.string(),
  model: v.string(),
  promptTokens: v.number(),
  completionTokens: v.number(),
  costUsd: v.number(),
  latencyMs: v.number(),
  ok: v.boolean(),
  errorKind: v.optional(v.string()),
});

export const recordDecision = mutation({
  args: {
    sessionId: v.id("sessions"),
    billId: v.id("bills"),
    agentId: v.id("agents"),
    vote: v.union(v.literal("yes"), v.literal("no"), v.literal("abstain")),
    reasoning: v.string(),
    llmCall: llmCallValidator,
  },
  handler: async (ctx, args) =>
    await recordDecisionHandler(
      ctx as Parameters<typeof recordDecisionHandler>[0],
      args,
    ),
});
