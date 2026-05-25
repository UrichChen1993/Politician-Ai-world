type SeedDb = {
  query: (table: string) => { collect: () => Promise<{ _id: unknown }[]> };
  insert: (table: string, doc: Record<string, unknown>) => Promise<unknown>;
  delete: (id: unknown) => Promise<void>;
};

export const AGENTS = [
  {
    name: "蔣萬安",
    profileRef: "chiang-wan-an",
    factionId: "KMT",
    stanceVector: { economic: 0.6, environment: 0.1, social: 0.4 },
    opinionState: 0.3,
  },
  {
    name: "賴士葆",
    profileRef: "lai-shih-pao",
    factionId: "KMT",
    stanceVector: { economic: 0.7, environment: -0.1, social: -0.8 },
    opinionState: -0.8,
  },
  {
    name: "黃國昌",
    profileRef: "huang-kuo-chang",
    factionId: "NPP",
    stanceVector: { economic: -0.2, environment: 0.3, social: 0.9 },
    opinionState: 0.9,
  },
  {
    name: "林昶佐",
    profileRef: "freddy-lim",
    factionId: "NPP",
    stanceVector: { economic: -0.3, environment: 0.2, social: 0.9 },
    opinionState: 0.8,
  },
  {
    name: "林岱樺",
    profileRef: "lin-tai-hua",
    factionId: "DPP",
    stanceVector: { economic: -0.3, environment: 0.2, social: -0.3 },
    opinionState: -0.5,
  },
] as const;

export const BILL = {
  number: "院總第 1148 號",
  title: "司法院釋字第七四八號解釋施行法",
  articles: [
    {
      articleNo: 2,
      text: "相同性別之二人，得為經營共同生活之目的，成立具有親密性及排他性之永久結合關係。",
      tags: ["marriage-equality", "civil-rights", "definition"],
    },
    {
      articleNo: 4,
      text: "成立第二條關係應以書面為之，有二人以上證人之簽名，並應由雙方當事人，依司法院釋字第七四八號解釋之意旨及本法，向戶政機關辦理結婚登記。",
      tags: ["marriage-registration", "civil-rights", "key-vote"],
    },
    {
      articleNo: 20,
      text: "第二條關係雙方當事人之一方收養他方之子女或共同收養時，準用民法關於收養之規定。",
      tags: ["adoption", "family-rights"],
    },
    {
      articleNo: 24,
      text: "民法總則編及債編關於夫妻、配偶、結婚或婚姻之規定，於第二條關係準用之。民法以外之其他法規關於夫妻、配偶、結婚或婚姻之規定，及配偶或夫妻關係所生之規定，於第二條關係準用之。但本法或其他法規另有規定者，不在此限。",
      tags: ["legal-parity", "civil-code"],
    },
    {
      articleNo: 26,
      text: "任何人或團體依法享有之宗教自由及其他自由權利，不因本法之施行而受影響。",
      tags: ["religious-freedom", "safeguard"],
    },
  ],
  stanceVector: { economic: 0.0, environment: 0.0, social: 0.9 },
  status: "voting" as const,
  actualVotes: [
    { agentId: "chiang-wan-an", vote: "yes" as const, sourceUrl: "https://www.ettoday.net/news/20190517/1446791.htm" },
    { agentId: "lai-shih-pao", vote: "no" as const, sourceUrl: "https://www.ettoday.net/news/20190517/1447140.htm" },
    { agentId: "huang-kuo-chang", vote: "yes" as const, sourceUrl: "https://www.setn.com/News.aspx?NewsID=542485" },
    { agentId: "freddy-lim", vote: "yes" as const, sourceUrl: "https://www.ettoday.net/news/20190517/1447238.htm" },
    { agentId: "lin-tai-hua", vote: "no" as const, sourceUrl: "https://www.cna.com.tw/news/firstnews/201905170054.aspx" },
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
