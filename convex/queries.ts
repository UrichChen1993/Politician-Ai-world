import { query } from "./_generated/server";
import { v } from "convex/values";

// Phase B: load everything the LLM tick needs in one query, so the action can
// fetch it via ctx.runQuery before making (non-deterministic) LLM calls.
export const getTickContext = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    const billId = session.billsInScope[0];
    if (!billId) throw new Error("Session has no bill in scope");
    const bill = await ctx.db.get(billId);
    if (!bill) throw new Error("Bill not found");
    const agents = await ctx.db.query("agents").collect();
    return { billId, bill, agents };
  },
});

export const listAgents = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("agents").collect(),
});

export const listBills = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("bills").collect(),
});

export const listBillVotes = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("billVotes").collect(),
});

export const listLlmCallLog = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("llmCallLog").collect(),
});

// Phase B verification: join one session's billVotes with their linked
// llmCallLog rows, so a caller can see — per session — how many votes were real
// LLM decisions vs. Phase A fallbacks, the errorKind breakdown, and total cost.
// `ok: false` ⇔ fallback (decideOnceLLM only marks a fallback row ok:false).
export const sessionStats = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const votes = (await ctx.db.query("billVotes").collect()).filter(
      (vote) => vote.sessionId === args.sessionId,
    );

    const errorKinds: Record<string, number> = {};
    let llmCount = 0;
    let fallbackCount = 0;
    let totalCostUsd = 0;
    let totalLatencyMs = 0;
    let logged = 0;
    const rows = [];

    for (const vote of votes) {
      const log = vote.llmCallId ? await ctx.db.get(vote.llmCallId) : null;
      if (log) {
        logged++;
        totalCostUsd += log.costUsd;
        totalLatencyMs += log.latencyMs;
        if (log.ok) llmCount++;
        else fallbackCount++;
        if (log.errorKind)
          errorKinds[log.errorKind] = (errorKinds[log.errorKind] ?? 0) + 1;
      }
      rows.push({
        agentId: vote.agentId,
        vote: vote.vote,
        source: log ? (log.ok ? "llm" : "fallback") : "unknown",
        errorKind: log?.errorKind,
        reasoning: vote.reasoning,
      });
    }

    return {
      sessionId: args.sessionId,
      votes: votes.length,
      llmCount,
      fallbackCount,
      errorKinds,
      totalCostUsd,
      avgLatencyMs: logged === 0 ? 0 : Math.round(totalLatencyMs / logged),
      rows,
    };
  },
});
