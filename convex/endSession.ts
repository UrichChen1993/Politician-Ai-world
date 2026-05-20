import { mutationGeneric } from "convex/server";
import { v } from "convex/values";
import type { Vote } from "./decideOnce.ts";

type ActualVote = {
  agentId: unknown;
  vote: Vote | "absent";
};

type SimulatedVote = {
  agentId: unknown;
  billId: unknown;
  vote: Vote;
};

type BillWithActualVotes = {
  _id: unknown;
  actualVotes?: ActualVote[];
};

type SessionDoc = {
  _id: unknown;
  billsInScope: unknown[];
};

type AgentDoc = {
  _id: unknown;
  profileRef: string;
};

type EndSessionDb = {
  get: (id: unknown) => Promise<SessionDoc | BillWithActualVotes | undefined | null>;
  patch: (id: unknown, doc: Record<string, unknown>) => Promise<void>;
  query: {
    (table: "billVotes"): { collect: () => Promise<SimulatedVote[]> };
    (table: "agents"): { collect: () => Promise<AgentDoc[]> };
  };
};

export async function endSessionHandler(
  ctx: { db: EndSessionDb },
  args: { sessionId: unknown },
): Promise<{ matchCount: number; total: number; matchRate: number }> {
  const session = await ctx.db.get(args.sessionId);
  if (!session || !("billsInScope" in session)) {
    throw new Error("Session not found");
  }

  const billId = session.billsInScope[0];
  if (!billId) {
    throw new Error("Session has no bill in scope");
  }

  const bill = await ctx.db.get(billId) as BillWithActualVotes | undefined | null;
  if (!bill || !("actualVotes" in bill) || !bill.actualVotes) {
    throw new Error("Bill has no actual votes to compare");
  }

  const agents = await ctx.db.query("agents").collect();
  const profileRefById = new Map(
    agents.map((agent) => [String(agent._id), agent.profileRef]),
  );

  const simulatedVotes = ((await ctx.db.query("billVotes").collect()) as SimulatedVote[]).filter(
    (vote) => vote.billId === billId,
  );
  const simulatedByProfileRef = new Map(
    simulatedVotes
      .map((vote) => [profileRefById.get(String(vote.agentId)), vote.vote] as const)
      .filter((entry): entry is readonly [string, Vote] => entry[0] !== undefined),
  );
  const matchCount = (bill.actualVotes as ActualVote[]).filter(
    (actual) => simulatedByProfileRef.get(String(actual.agentId)) === actual.vote,
  ).length;
  const total = bill.actualVotes.length;

  await ctx.db.patch(args.sessionId, { endedAt: Date.now() });

  return {
    matchCount,
    total,
    matchRate: total === 0 ? 0 : matchCount / total,
  };
}

export const endSession = mutationGeneric({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) =>
    await endSessionHandler(ctx as unknown as { db: EndSessionDb }, args),
});
