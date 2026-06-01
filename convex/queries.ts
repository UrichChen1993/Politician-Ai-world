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
