import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { recordVoteHandler } from "./lib/recordVoteHandler.ts";

export { recordVoteHandler } from "./lib/recordVoteHandler.ts";
export type { RecordVoteArgs } from "./lib/recordVoteHandler.ts";

export const recordVote = mutation({
  args: {
    sessionId: v.id("sessions"),
    billId: v.id("bills"),
    agentId: v.id("agents"),
    vote: v.union(v.literal("yes"), v.literal("no"), v.literal("abstain")),
    reasoning: v.string(),
    llmCallId: v.optional(v.id("llmCallLog")),
  },
  handler: async (ctx, args) =>
    await recordVoteHandler(ctx as Parameters<typeof recordVoteHandler>[0], args),
});
