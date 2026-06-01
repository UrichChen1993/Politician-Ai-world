import { decideOnceLLM, type LlmCallLogEntry } from "./decideOnceLLM.ts";
import type { LlmClient } from "./llm/provider.ts";
import type { StanceVector, Vote } from "./decisionLogic.ts";

export type TickAgent = {
  _id: unknown;
  name: string;
  factionId: string;
  persona?: string;
  stanceVector: StanceVector;
};

export type TickBill = {
  _id: unknown;
  number: string;
  title: string;
  articles: { articleNo: number; text: string; tags?: readonly string[] }[];
  stanceVector: StanceVector;
};

// Ports abstract the Convex action's runQuery/runMutation so the loop is
// testable with fakes. The action wires the real implementations.
export type TickPorts = {
  load: (
    sessionId: unknown,
  ) => Promise<{ billId: unknown; bill: TickBill; agents: TickAgent[] }>;
  record: (decision: {
    sessionId: unknown;
    billId: unknown;
    agentId: unknown;
    vote: Vote;
    reasoning: string;
    llmCall: LlmCallLogEntry;
  }) => Promise<void>;
};

export type RunTickLLMArgs = {
  sessionId: unknown;
  client: LlmClient;
  model: string;
  timeoutMs?: number;
};

export async function runTickLLMHandler(
  ports: TickPorts,
  args: RunTickLLMArgs,
): Promise<{ decisions: number; billId: unknown; fallbacks: number }> {
  const { billId, bill, agents } = await ports.load(args.sessionId);

  let fallbacks = 0;
  for (const agent of agents) {
    const result = await decideOnceLLM({
      agent,
      bill,
      client: args.client,
      model: args.model,
      timeoutMs: args.timeoutMs,
    });
    if (result.source === "fallback") fallbacks++;
    await ports.record({
      sessionId: args.sessionId,
      billId,
      agentId: agent._id,
      vote: result.vote,
      reasoning: result.reasoning,
      llmCall: result.llmCall,
    });
  }

  return { decisions: agents.length, billId, fallbacks };
}
