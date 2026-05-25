## Why

專案目前只有設計文件（docs/design/*.md）和 ground-truth schema，零程式碼。根據 docs/04-poc-plan.md 的結論「先建 skeleton，邊跑邊補」，需要一個能跑、能驗證的最小工程骨架，才能推進 Phase A mock 和 Phase B LLM 實驗。

## What Changes

- 初始化 Vite + React + TypeScript 專案結構（package.json、tsconfig、vite.config）
- 安裝並初始化 Convex 後端（convex/ 目錄、schema、函式）
- 建立 5 張核心資料表 + 3 張佔位空表的 Convex schema
- 建立核心模擬函式骨架：runTick、decideOnce、recordVote、endSession
- 建立 seeded RNG helper（解 gaps #17）
- 建立 Observatory 前端空殼頁面
- 建立 seed action 以載入 ground-truth 測試資料

## Capabilities

### New Capabilities
- `convex-schema`: Convex 資料表定義（agents, bills, sessions, billVotes, llmCallLog + 3 張佔位表）
- `simulation-core`: 核心模擬迴圈函式（runTick, decideOnce, recordVote, endSession）及 Phase A mock 規則
- `rng-helper`: Seeded random number generator，確保模擬可重現
- `observatory-ui`: 最小 Observatory 前端（agent 列表、法案狀態、投票結果、成本摘要 placeholder）
- `seed-data`: 種子資料載入 action，從 ground-truth.json 寫入 Convex 表

### Modified Capabilities

（無既有 capability）

## Impact

- 新增 `convex/`、`src/` 目錄及所有前後端程式碼
- 新增 npm 依賴：react, react-dom, convex, vite, typescript
- 需要 Convex 帳號及專案（`npx convex dev` 部署）
- `data/ground-truth.json` 需填入實際或假資料才能跑通 seed
