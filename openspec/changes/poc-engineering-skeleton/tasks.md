## 1. 專案初始化

- [x] 1.1 執行 `npm create vite@latest` 初始化 React + TypeScript 專案
- [x] 1.2 安裝 Convex 依賴 (`npm install convex`)
- [x] 1.3 建立 convex/ 目錄結構（手動，需之後 `npx convex dev` 連結帳號）

## 2. Convex Schema

- [x] 2.1 建立 `convex/schema.ts`：定義 agents, bills, sessions, billVotes, llmCallLog 五張核心表
- [x] 2.2 在 schema 中加入 mediaOutlets, newsItems, externalEvents 三張佔位空表


## 3. 核心模擬函式

- [x] 3.1 建立 `convex/lib/rng.ts`：mulberry32 seeded RNG helper
- [x] 3.2 建立 `convex/decideOnce.ts`：Phase A mock 規則 (dot product sign)
- [x] 3.3 建立 `convex/recordVote.ts`：寫入 billVotes mutation
- [x] 3.4 建立 `convex/runTick.ts`：遍歷 agents 呼叫 decideOnce + recordVote
- [x] 3.5 建立 `convex/endSession.ts`：標記 session 結束 + 比對 ground truth

## 4. 種子資料

- [x] 4.1 建立 `convex/seed.ts`：seed action，插入 5 位 placeholder 政治人物 + 1 部 placeholder 法案
- [x] 4.2 確保 seed 冪等（先清再插）

## 5. Observatory 前端

- [x] 5.1 設定 `src/main.tsx` + `src/App.tsx` 接 ConvexProvider
- [ ] 5.2 建立 `src/pages/Observatory.tsx`：agent 列表、法案狀態、投票結果、成本摘要 placeholder
- [ ] 5.3 加入 Convex useQuery hooks 連接後端資料

## 6. 驗證

- [ ] 6.1 `npm run dev` 啟動 Vite 成功
- [ ] 6.2 `npx convex dev` 部署 schema 成功
- [ ] 6.3 執行 seed action 寫入假資料
- [ ] 6.4 Observatory 頁面能顯示 seed 資料
