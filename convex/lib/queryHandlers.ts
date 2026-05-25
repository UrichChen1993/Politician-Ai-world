type QueryDb = {
  query: (table: string) => { collect: () => Promise<unknown[]> };
};

type QueryCtx = { db: QueryDb };

export async function listAgentsHandler(ctx: QueryCtx) {
  return await ctx.db.query("agents").collect();
}

export async function listBillsHandler(ctx: QueryCtx) {
  return await ctx.db.query("bills").collect();
}

export async function listBillVotesHandler(ctx: QueryCtx) {
  return await ctx.db.query("billVotes").collect();
}

export async function listLlmCallLogHandler(ctx: QueryCtx) {
  return await ctx.db.query("llmCallLog").collect();
}
