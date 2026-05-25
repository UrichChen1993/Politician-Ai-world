import { query } from "./_generated/server";
import { v } from "convex/values";
import { dotProduct, decideVote, reasoningForScore } from "./lib/decisionLogic.ts";

export type { StanceVector, Vote } from "./lib/decisionLogic.ts";
export { dotProduct, decideVote, reasoningForScore } from "./lib/decisionLogic.ts";

const stanceVectorArg = v.object({
  economic: v.number(),
  environment: v.number(),
  social: v.number(),
});

export const decideOnce = query({
  args: {
    agentStanceVector: stanceVectorArg,
    billStanceVector: stanceVectorArg,
  },
  handler: async (_ctx, args) => {
    const score = dotProduct(args.agentStanceVector, args.billStanceVector);
    return {
      vote: decideVote(args.agentStanceVector, args.billStanceVector),
      reasoning: reasoningForScore(score),
      score,
    };
  },
});
