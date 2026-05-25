import { decideVote, dotProduct, reasoningForScore, type StanceVector } from "./decisionLogic.ts";
import { recordVoteHandler } from "./recordVoteHandler.ts";

type AgentDoc = {
  _id: unknown;
  stanceVector: StanceVector;
};

type BillDoc = {
  _id: unknown;
  stanceVector: StanceVector;
};

type SessionDoc = {
  _id: unknown;
  billsInScope: unknown[];
};

type QueryableDb = {
  get: (id: unknown) => Promise<SessionDoc | BillDoc | undefined | null>;
  query: (table: "agents") => { collect: () => Promise<AgentDoc[]> };
  insert: (table: "billVotes", doc: Record<string, unknown>) => Promise<unknown>;
};

export async function runTickHandler(
  ctx: { db: QueryableDb },
  args: { sessionId: unknown },
): Promise<{ decisions: number; billId: unknown }> {
  const session = await ctx.db.get(args.sessionId);
  if (!session || !("billsInScope" in session)) {
    throw new Error("Session not found");
  }

  const billId = session.billsInScope[0];
  if (!billId) {
    throw new Error("Session has no bill in scope");
  }

  const bill = await ctx.db.get(billId) as BillDoc | undefined | null;
  if (!bill || !("stanceVector" in bill)) {
    throw new Error("Bill not found");
  }

  const agents = await ctx.db.query("agents").collect() as AgentDoc[];

  for (const agent of agents) {
    const score = dotProduct(agent.stanceVector, bill.stanceVector);
    await recordVoteHandler(ctx, {
      sessionId: args.sessionId,
      billId,
      agentId: agent._id,
      vote: decideVote(agent.stanceVector, bill.stanceVector),
      reasoning: reasoningForScore(score),
    });
  }

  return { decisions: agents.length, billId };
}
