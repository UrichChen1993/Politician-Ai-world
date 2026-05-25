# Politician AI World

用 LLM 驅動的政治人物 Agent 模擬立法投票行為，以 ground truth 法案驗證模擬準確度。

## 專案目標

以 5 位真實政治人物為原型建立 AI Agent，模擬法案表決過程，目標是模擬投票與實際投票的吻合率 >= 4/5。

- **Phase A**（目前）：Mock 規則 — 以 stance vector dot product 決定投票
- **Phase B**（計畫中）：接入真實 LLM，讓 Agent 依 profile 與法案內容推論投票

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

## 專案結構

```
convex/                 # Convex 後端
  schema.ts             # 資料表定義（agents, bills, sessions, billVotes, llmCallLog）
  queries.ts            # 前端查詢用 query functions
  seed.ts               # 種子資料 action
  decideOnce.ts         # Phase A 投票決策（dot product sign）
  recordVote.ts         # 寫入投票紀錄
  runTick.ts            # 模擬迴圈：遍歷 agents 執行投票
  endSession.ts         # 結束 session 並比對 ground truth
  lib/
    rng.ts              # Mulberry32 seeded RNG
    seedData.ts         # 種子資料定義（5 agents + 1 bill）
    queryHandlers.ts    # 可測試的 query handler 函式

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
