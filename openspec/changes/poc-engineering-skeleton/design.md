## Context

專案有完整設計文件（docs/design/*.md）和 PoC 計畫（docs/04-poc-plan.md），但零程式碼。技術棧已確定：Convex + Vite + React + TypeScript + Anthropic SDK（LLM 階段）。目標是建出能跑 Phase A mock 的最小骨架。

## Goals / Non-Goals

**Goals:**
- 專案結構能 `npm run dev` + `npx convex dev` 跑起來
- Convex schema 對齊 04-poc-plan.md §4.2 的 5 張核心表
- 核心模擬函式有型別正確的骨架，Phase A mock 規則可執行
- Observatory 前端能連 Convex 顯示資料
- seed action 能載入假資料跑通全流程

**Non-Goals:**
- Phase B LLM 整合（後續 change）
- 真實 ground-truth 資料蒐集（用戶手動）
- 媒體/選民/派系動態邏輯
- 部署到 production

## Decisions

### 1. 專案結構：單一 repo，Convex 在根目錄
Vite 專案在根目錄，`convex/` 作為 Convex 後端目錄。不用 monorepo 工具。
**理由**：PoC 規模小，單一 repo 最簡單。Convex CLI 預設就是這個結構。

### 2. Convex 函式組織：按功能分檔，不用子目錄
`convex/` 下直接放 `runTick.ts`、`decideOnce.ts` 等，不建 `functions/` 子目錄。
**理由**：Convex 函式路徑即 API 路徑，扁平結構在 PoC 階段更直觀。如果函式超過 10 個再重組。

### 3. stanceVector 用三維 object `{economic, environment, social}`
對齊 `data/ground-truth.schema.json` 已定義的格式。Convex schema 用 `v.object()` 直接表達。
**理由**：已有 schema 定義，不需要抽象成泛型向量。

### 4. Phase A mock：dot product sign 規則
`decideOnce` Phase A 實作 = `sign(dot(agent.stanceVector, bill.stanceVector))`，正 → yes，負 → no，零 → abstain。
**理由**：04-poc-plan.md §4.4 明確指定。

### 5. Seeded RNG：用 mulberry32 演算法
輕量、確定性、無外部依賴。seed 從 session 表讀取。
**理由**：PoC 只需要基本的可重現隨機數，不需要密碼學等級。

### 6. Observatory 前端：純 React + Convex useQuery
不引入 UI library（Tailwind / shadcn 等），用最小 CSS。
**理由**：04-poc-plan.md §4.1 明確要求「不引入額外 UI library」。

## Risks / Trade-offs

- **Convex 帳號依賴** → 開發者需先 `npx convex login`；離線無法測試後端。Mitigation：Phase A 的 mock 邏輯可以寫成純函式單獨測試。
- **Schema 遷移** → 如果跑通後發現表結構不對，Convex migration 可能需要清資料。Mitigation：PoC 階段資料可隨時重建（seed action）。
- **佔位空表浪費** → mediaOutlets/newsItems/externalEvents 先建空表佔位。Trade-off：避免後續 migration 痛苦，代價是 schema 有未使用的表。
