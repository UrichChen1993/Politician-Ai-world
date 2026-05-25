export type StanceVector = {
  economic: number;
  environment: number;
  social: number;
};

export type Vote = "yes" | "no" | "abstain";

export function dotProduct(agent: StanceVector, bill: StanceVector): number {
  return (
    agent.economic * bill.economic +
    agent.environment * bill.environment +
    agent.social * bill.social
  );
}

export function decideVote(agent: StanceVector, bill: StanceVector): Vote {
  const score = dotProduct(agent, bill);
  if (score > 0) return "yes";
  if (score < 0) return "no";
  return "abstain";
}

export function reasoningForScore(score: number): string {
  return `Phase A stance dot product=${score.toFixed(4)}`;
}
