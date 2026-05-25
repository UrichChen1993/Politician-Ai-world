import { query } from "./_generated/server";

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
