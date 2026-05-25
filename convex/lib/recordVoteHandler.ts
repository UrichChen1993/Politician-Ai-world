import type { Vote } from "./decisionLogic.ts";

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
