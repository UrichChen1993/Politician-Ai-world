import { query } from "./_generated/server";
import { v } from "convex/values";

export type StanceVector = {
  economic: number;
  environment: number;
  social: number;
};

export type Vote = "yes" | "no" | "abstain";

const stanceVectorArg = v.object({
  economic: v.number(),
  environment: v.number(),
  social: v.number(),
});

export function dotProduct(agent: StanceVector, bill: StanceVector): number {
  return (
    agent.economic * bill.economic +
    agent.environment * bill.environment +
    agent.social * bill.social
  );
}

export function decideVote(agent: StanceVector, bill: StanceVector): Vote {
  const score = dotProduct(agent, bill);

  if (score > 0) {
    return "yes";
  }
  if (score < 0) {
    return "no";
  }
  return "abstain";
}

export function reasoningForScore(score: number): string {
  return `Phase A stance dot product=${score.toFixed(4)}`;
}

export const decideOnce = query({
  args: {
    agentStanceVector: stanceVectorArg,
    billStanceVector: stanceVectorArg,
  },
  handler: async (_ctx, args: { agentStanceVector: StanceVector; billStanceVector: StanceVector }) => {
    const score = dotProduct(args.agentStanceVector, args.billStanceVector);

    return {
      vote: decideVote(args.agentStanceVector, args.billStanceVector),
      reasoning: reasoningForScore(score),
      score,
    };
  },
});
