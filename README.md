# Politician AI World

用 LLM 驅動的政治人物 Agent 模擬立法投票行為，以 ground truth 法案驗證模擬準確度。

## 專案目標

以 5 位真實政治人物為原型建立 AI Agent，模擬法案表決過程，目標是模擬投票與實際投票的吻合率 >= 4/5。

- **Phase A**：Mock 規則 — 以 stance vector dot product 決定投票（已完成，5/5 吻合）
- **Phase B**（實作中）：接入真實 LLM，讓 Agent 依 leak-free 側寫與法案內容推論投票，外包四層容錯（schema 驗證 + 重試、引用檢查、逾時、全程記錄），失敗自動降級回 Phase A 點積

## 技術棧

- **前端**：React 19 + TypeScript + Vite
- **後端**：[Convex](https://convex.dev)（即時資料庫 + serverless functions）
- **測試**：Node.js built-in test runner (`node --test`)
- **LLM**（Phase B）：Anthropic SDK

## 快速開始

```bash
# 安裝依賴
npm install

# 啟動 Convex 後端（需先 npx convex login）
npx convex dev

# 另一個 terminal，啟動前端
npm run dev

# 在 Convex dashboard 執行 seed action 載入假資料
# 或在 npx convex dev 的 terminal 執行：
npx convex run seed:seed
```

### Phase B：跑 LLM 決策

LLM 決策走 `runTickLLM` action，provider 可選 Anthropic（Haiku 4.5，預設）或
DeepSeek（OpenAI 相容）。完整步驟：

```bash
# 1. 設定 provider 與金鑰（擇一 provider）
#    Anthropic（預設）
npx convex env set ANTHROPIC_API_KEY <your-key>
#    或 DeepSeek
npx convex env set LLM_PROVIDER deepseek
npx convex env set DEEPSEEK_API_KEY <your-key>
#    （選用）覆寫模型
npx convex env set LLM_MODEL <model-id>

# 2. 部署 + 重新產生 _generated/api（含 getTickContext / recordDecision / runTickLLM）
npx convex dev

# 3. 載入種子資料（若尚未）— 只建立 agents + bills，回傳 { agents: 5, bills: 1 }
npx convex run seed:seed

# 4. 建立一個 session 並取得 sessionId（seed 不會產生 sessionId）
#    回傳 { sessionId: "<id>", billsInScope: 1 }；可選 seed 參數（預設 748）
npx convex run startSession:startSession
#    （選用）指定 seed：npx convex run startSession:startSession '{"seed":748}'

# 5. 把上一步的 sessionId 填入，對該 session 跑一個 LLM tick
#    macOS / Linux (bash/zsh)：
npx convex run runTickLLM:runTickLLM '{"sessionId":"<id>"}'
#    Windows PowerShell：內層雙引號需用反斜線跳脫（npx.cmd shim 會吃掉裸引號）
npx convex run runTickLLM:runTickLLM '{\"sessionId\":\"<id>\"}'
```

> **Windows 注意**：上面所有帶 JSON 參數的指令（含 `startSession` 的 `'{"seed":748}'`）
> 在 PowerShell 都要把內層 `"` 改成 `\"`——例如 `'{\"seed\":748}'`、
> `'{\"sessionId\":\"<id>\"}'`，否則會出現 `Failed to parse arguments as JSON` 錯誤。

每位 agent 會產生一筆投票 + 一筆 `llmCallLog`（tokens / 成本 / 延遲 / errorKind）。
任何 LLM 失敗都會自動降級回 Phase A 點積決策，並在 `llmCallLog.errorKind` 留痕；
失敗形狀累積於 [docs/design/failure-model.md](docs/design/failure-model.md)。

> **注意**：`convex/_generated/api` 在跑過 `npx convex dev` 前不含 Phase B 的新函式，
> 屬正常現象——dev 會自動重新產生。app build（`tsc -b`）不檢查 `convex/`，不受影響。

### Phase B：一鍵驗收

不用手動一筆筆翻表——`verifyPhaseB` action 會自動跑 N 次
`startSession → runTickLLM → endSession → sessionStats` 並彙整成一張摘要：

```bash
# bash/zsh
npx convex run verifyPhaseB:verifyPhaseB '{"runs":10}'
# Windows PowerShell（內層引號需跳脫）
npx convex run verifyPhaseB:verifyPhaseB '{\"runs\":10}'
```

摘要由上到下判讀：

1. **`totalFallbacks` vs `totalLlmCalls`** — 先看這個。fallback 一多，下面的吻合率其實是
   Phase A 點積的成績，不是 LLM 的。`errorKinds` 說明為何降級（timeout /
   schema_validation_failed / …）。
2. **`avgMatchRate` + `matchRates`** — 對 ground truth 的吻合率，目標 ≥ 0.8（4/5）。
3. **`matchRates` 離散程度** — 種子穩定性；同 seed 應該很穩，跳動大代表 LLM 不穩定。
4. **`totalCostUsd` / `avgLatencyMs`** — 成本與延遲的量綱 sanity。

單看某次每位 agent 投什麼、理由為何（join 投票與 `llmCallLog`）：

```bash
npx convex run queries:sessionStats '{\"sessionId\":\"<id>\"}'   # PowerShell 引號跳脫同上
```

**驗收（poc-plan 任務 7、8）**：以上 `verifyPhaseB` 跑約 10 次比對吻合率（目標 ≥ 4/5）+
隨機種子穩定性，再從 `errorKinds` 反推回填 [failure-model.md](docs/design/failure-model.md)。

## 專案結構

```
convex/                 # Convex 後端
  schema.ts             # 資料表定義（agents, bills, sessions, billVotes, llmCallLog）
  queries.ts            # 前端查詢用 query functions
  seed.ts               # 種子資料 action
  decideOnce.ts         # Phase A 投票決策（dot product sign）
  recordVote.ts         # 寫入投票紀錄
  runTick.ts            # Phase A 模擬迴圈：遍歷 agents 執行點積投票
  runTickLLM.ts         # Phase B action：遍歷 agents 跑 LLM 決策（provider 由 env 選）
  recordDecision.ts     # Phase B mutation：寫 llmCallLog + 連結的 billVote
  endSession.ts         # 結束 session 並比對 ground truth
  lib/
    rng.ts              # Mulberry32 seeded RNG
    seedData.ts         # 種子資料定義（5 agents + 1 bill，含 leak-free persona）
    queryHandlers.ts    # 可測試的 query handler 函式
    decideOnceLLM.ts    # Phase B 核心：四層容錯 + fallback（純函式，注入 client）
    decisionPrompt.ts   # 組 LLM prompt（leak-free，排除實際投票）
    decisionParse.ts    # 解析/驗證 LLM 回傳（schema 層）
    referenceCheck.ts   # 引用幻覺檢查
    runTickLLMHandler.ts # Phase B tick 迴圈（注入 ports，可測）
    recordDecisionHandler.ts # 寫入決策的可測 handler
    llm/                # provider 抽象：config / cost / anthropic / deepseek

src/                    # React 前端
  main.tsx              # 入口，掛載 ConvexProvider
  App.tsx               # 接 useQuery hooks 並渲染 Observatory
  pages/
    Observatory.tsx     # 主頁面：agent 列表、法案狀態、投票結果、LLM 成本
    observatory.helpers.ts

tests/                  # 測試（node --test）
  convexSchema.test.mjs
  simulationCore.test.mjs
  seed.test.mjs
  observatory.test.mjs
  queries.test.mjs

docs/                   # 設計文件
openspec/               # OpenSpec 變更規格
```

## 測試

```bash
npm test
```

## 核心概念

| 概念 | 說明 |
|------|------|
| Agent | 政治人物 AI 代理人，擁有 stance vector（economic, environment, social） |
| Bill | 法案，包含條文、stance vector、實際投票記錄（ground truth） |
| Session | 一次模擬會期，包含 seed 與法案範圍 |
| Observatory | 觀測介面，顯示模擬狀態與結果 |

## 設計文件

詳見 `docs/` 目錄：

- `docs/04-poc-plan.md` — PoC 實作計畫與驗收條件
- `docs/design/` — 各子系統設計（時間模型、法案模型、LLM 成本模型等）
- `openspec/changes/poc-engineering-skeleton/` — 工程骨架變更規格

## License

Private — 未公開授權。
