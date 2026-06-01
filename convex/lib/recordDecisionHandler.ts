import { recordVoteHandler } from "./recordVoteHandler.ts";
import type { LlmCallLogEntry } from "./decideOnceLLM.ts";
import type { Vote } from "./decisionLogic.ts";

type RecordDb = {
  insert: (
    table: "billVotes" | "llmCallLog",
    doc: Record<string, unknown>,
  ) => Promise<unknown>;
};

export type RecordDecisionArgs = {
  sessionId: unknown;
  billId: unknown;
  agentId: unknown;
  vote: Vote;
  reasoning: string;
  llmCall: LlmCallLogEntry;
};

// Persist one Phase B decision: write the llmCallLog row first, then the
// billVote linked to it by llmCallId. errorKind is only stored when present.
export async function recordDecisionHandler(
  ctx: { db: RecordDb },
  args: RecordDecisionArgs,
): Promise<{ llmCallId: unknown; voteId: unknown }> {
  const { llmCall } = args;
  const logDoc: Record<string, unknown> = {
    agentId: args.agentId,
    action: llmCall.action,
    model: llmCall.model,
    promptTokens: llmCall.promptTokens,
    completionTokens: llmCall.completionTokens,
    costUsd: llmCall.costUsd,
    latencyMs: llmCall.latencyMs,
    ok: llmCall.ok,
  };
  if (llmCall.errorKind !== undefined) logDoc.errorKind = llmCall.errorKind;

  const llmCallId = await ctx.db.insert("llmCallLog", logDoc);

  const voteId = await recordVoteHandler(ctx, {
    sessionId: args.sessionId,
    billId: args.billId,
    agentId: args.agentId,
    vote: args.vote,
    reasoning: args.reasoning,
    llmCallId,
  });

  return { llmCallId, voteId };
}
