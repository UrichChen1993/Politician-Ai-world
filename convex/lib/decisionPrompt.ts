import type { StanceVector } from "./decisionLogic.ts";

export type PromptAgent = {
  name: string;
  factionId: string;
  stanceVector: StanceVector;
  persona?: string;
};

export type PromptBill = {
  number: string;
  title: string;
  articles: { articleNo: number; text: string; tags?: readonly string[] }[];
};

export type DecisionPrompt = { system: string; user: string };

// Fixed across all agents → cacheable system header (see llm-cost-model.md §4).
const SYSTEM_HEADER = `你是一個政治行為模擬系統。你的任務是根據一位立法委員的背景與立場，預測他對一部法案的表決行為。

規則：
- 僅依據以下提供的人物側寫與法案內容推論。不要使用你對該人物真實歷史投票的記憶或外部知識。
- 立場向量為三維 (economic, environment, social)，數值範圍 -1 至 +1（social 越高代表社會議題越進步）。
- 你必須只回覆一個 JSON 物件，不要有任何其他文字、說明或 markdown 圍欄。格式如下：
  {"vote": "yes" | "no" | "abstain", "reasoning": "<一句中文理由>", "citedArticles": [<引用到的條號數字>]}
- vote 僅能是 yes、no、abstain 三者之一。
- citedArticles 只能引用法案中實際存在的條號；若未具體引用任何條文則為空陣列 []。`;

export function buildDecisionPrompt(
  agent: PromptAgent,
  bill: PromptBill,
): DecisionPrompt {
  const s = agent.stanceVector;
  const persona = agent.persona?.trim()
    ? agent.persona.trim()
    : `${agent.name}，所屬派系 ${agent.factionId}。`;
  const articles = bill.articles
    .map((a) => `第 ${a.articleNo} 條：${a.text}`)
    .join("\n");

  const user = [
    "## 人物側寫",
    `姓名：${agent.name}`,
    `派系：${agent.factionId}`,
    `立場向量：economic=${s.economic}, environment=${s.environment}, social=${s.social}`,
    `背景：${persona}`,
    "",
    "## 待表決法案",
    `${bill.number} ${bill.title}`,
    "核心條文：",
    articles,
    "",
    "## 任務",
    `根據以上人物側寫與法案內容，預測 ${agent.name} 對本法案的表決，並以指定的 JSON 格式回覆。`,
  ].join("\n");

  return { system: SYSTEM_HEADER, user };
}
