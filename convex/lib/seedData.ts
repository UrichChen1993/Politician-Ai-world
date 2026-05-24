type SeedDb = {
  query: (table: string) => { collect: () => Promise<{ _id: unknown }[]> };
  insert: (table: string, doc: Record<string, unknown>) => Promise<unknown>;
  delete: (id: unknown) => Promise<void>;
};

export const AGENTS = [
  {
    name: "王立委",
    profileRef: "wang-liwei",
    factionId: "blue",
    stanceVector: { economic: 0.8, environment: -0.3, social: 0.2 },
    opinionState: 0,
  },
  {
    name: "李議員",
    profileRef: "li-yiyuan",
    factionId: "green",
    stanceVector: { economic: -0.5, environment: 0.7, social: 0.6 },
    opinionState: 0,
  },
  {
    name: "張代表",
    profileRef: "zhang-daibiao",
    factionId: "blue",
    stanceVector: { economic: 0.6, environment: 0.1, social: -0.4 },
    opinionState: 0,
  },
  {
    name: "陳委員",
    profileRef: "chen-weiyuan",
    factionId: "green",
    stanceVector: { economic: -0.3, environment: 0.5, social: 0.8 },
    opinionState: 0,
  },
  {
    name: "林立委",
    profileRef: "lin-liwei",
    factionId: "independent",
    stanceVector: { economic: 0.1, environment: 0.2, social: -0.1 },
    opinionState: 0,
  },
] as const;

export const BILL = {
  number: "POC-001",
  title: "再生能源發展條例修正草案",
  articles: [
    {
      articleNo: 1,
      text: "為促進再生能源發展，特修正本條例。",
      tags: ["energy", "environment"],
    },
    {
      articleNo: 2,
      text: "各級政府應編列預算補助再生能源設施建設。",
      tags: ["budget", "environment"],
    },
  ],
  stanceVector: { economic: -0.2, environment: 0.9, social: 0.3 },
  status: "voting" as const,
  actualVotes: [
    { agentId: "wang-liwei", vote: "no" as const, sourceUrl: "https://example.test/vote/wang" },
    { agentId: "li-yiyuan", vote: "yes" as const, sourceUrl: "https://example.test/vote/li" },
    { agentId: "zhang-daibiao", vote: "no" as const, sourceUrl: "https://example.test/vote/zhang" },
    { agentId: "chen-weiyuan", vote: "yes" as const, sourceUrl: "https://example.test/vote/chen" },
    { agentId: "lin-liwei", vote: "abstain" as const, sourceUrl: "https://example.test/vote/lin" },
  ],
} as const;

export async function seedHandler(ctx: { db: SeedDb }): Promise<{ agents: number; bills: number }> {
  // Clear existing agents and bills (idempotent)
  const existingAgents = await ctx.db.query("agents").collect();
  for (const agent of existingAgents) {
    await ctx.db.delete(agent._id);
  }

  const existingBills = await ctx.db.query("bills").collect();
  for (const bill of existingBills) {
    await ctx.db.delete(bill._id);
  }

  // Insert agents
  for (const agent of AGENTS) {
    await ctx.db.insert("agents", { ...agent });
  }

  // Insert bill
  await ctx.db.insert("bills", { ...BILL });

  return { agents: AGENTS.length, bills: 1 };
}
