import { mutationGeneric } from "convex/server";
import { v } from "convex/values";
import type { Vote } from "./decideOnce.ts";

const voteArg = v.union(v.literal("yes"), v.literal("no"), v.literal("abstain"));

export type RecordVoteArgs = {
  sessionId: unknown;
  billId: unknown;
  agentId: unknown;
  vote: Vote;
  reasoning: string;
  llmCallId?: unknown;
};

type InsertableDb = {
  insert: (table: "billVotes", doc: Record<string, unknown>) => Promise<unknown>;
};

export async function recordVoteHandler(
  ctx: { db: InsertableDb },
  args: RecordVoteArgs,
): Promise<unknown> {
  const doc: Record<string, unknown> = {
    sessionId: args.sessionId,
    billId: args.billId,
    agentId: args.agentId,
    vote: args.vote,
    reasoning: args.reasoning,
  };

  if (args.llmCallId !== undefined) {
    doc.llmCallId = args.llmCallId;
  }

  return await ctx.db.insert("billVotes", doc);
}

export const recordVote = mutationGeneric({
  args: {
    sessionId: v.id("sessions"),
    billId: v.id("bills"),
    agentId: v.id("agents"),
    vote: voteArg,
    reasoning: v.string(),
    llmCallId: v.optional(v.id("llmCallLog")),
  },
  handler: recordVoteHandler,
});
