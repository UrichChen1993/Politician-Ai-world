# PoC Engineering Skeleton Task 3 實作紀錄

> 版本：2 ｜ 更新日期：2026-05-20 ｜ 狀態：current
> 來源：OpenSpec change `poc-engineering-skeleton` task 3
> 對齊：[../04-poc-plan.md](../04-poc-plan.md)、[../../openspec/changes/poc-engineering-skeleton/specs/simulation-core/spec.md](../../openspec/changes/poc-engineering-skeleton/specs/simulation-core/spec.md)、[../../openspec/changes/poc-engineering-skeleton/specs/rng-helper/spec.md](../../openspec/changes/poc-engineering-skeleton/specs/rng-helper/spec.md)
> 目的：記錄核心模擬函式的 TDD 實作內容、行為邊界與驗證結果

---

## 1. 完成範圍

本次完成 OpenSpec task 3 的五個子項：

- 3.1 建立 `convex/lib/rng.ts`：mulberry32 seeded RNG helper。
- 3.2 建立 `convex/decideOnce.ts`：Phase A mock 規則，使用 dot product sign 決定投票。
- 3.3 建立 `convex/recordVote.ts`：寫入 `billVotes` mutation。
- 3.4 建立 `convex/runTick.ts`：遍歷 agents，產生並記錄每位 agent 的投票。
- 3.5 建立 `convex/endSession.ts`：標記 session 結束，並比對 ground truth actual votes。

這次只處理核心模擬函式，不包含 seed action、Observatory 前端或 `npx convex dev` 部署驗證。

## 2. 核心行為

### Seeded RNG

實作檔案：[../../convex/lib/rng.ts](../../convex/lib/rng.ts)

`rng(seed)` 回傳一個 deterministic pseudo-random generator：

- 相同 seed 會產生相同序列。
- 每次輸出落在 `[0, 1)`。
- 使用 mulberry32，無外部依賴。

### Phase A 投票規則

實作檔案：[../../convex/decideOnce.ts](../../convex/decideOnce.ts)

Phase A mock 規則：

```text
score = dot(agent.stanceVector, bill.stanceVector)
score > 0  => yes
score < 0  => no
score == 0 => abstain
```

檔案同時提供：

- `dotProduct`
- `decideVote`
- `reasoningForScore`
- Convex query `decideOnce`

### 記錄投票

實作檔案：[../../convex/recordVote.ts](../../convex/recordVote.ts)

`recordVoteHandler` 寫入 `billVotes`：

- `sessionId`
- `billId`
- `agentId`
- `vote`
- `reasoning`
- 可選 `llmCallId`

Convex mutation `recordVote` 包裝同一個 handler，讓單元測試可以直接測純 handler 行為。

### 推進一個 Tick

實作檔案：[../../convex/runTick.ts](../../convex/runTick.ts)

`runTickHandler` 行為：

1. 讀取 session。
2. 取 `billsInScope[0]` 作為 PoC 目前唯一處理的 bill。
3. 讀取 bill stance vector。
4. 遍歷所有 agents。
5. 對每個 agent 執行 Phase A dot product vote rule。
6. 呼叫 `recordVoteHandler` 寫入 `billVotes`。

目前 PoC 假設一個 session scope 內先跑一個 bill；多 bill 策略留到後續 change。

### 結束 Session 與 Ground Truth 比對

實作檔案：[../../convex/endSession.ts](../../convex/endSession.ts)

`endSessionHandler` 行為：

1. 讀取 session。
2. 取 `billsInScope[0]` 找到 bill。
3. 從 bill 的 optional `actualVotes` 讀取 ground truth。
4. 讀取本 bill 的 `billVotes`。
5. collect `agents` 建立 `Convex Id → profileRef` map，將 simulated votes 重新 key 成 `profileRef`，再與 `actualVotes[].agentId`（外部字串 ID）比對。
6. 寫入 session `endedAt`。
7. 回傳 `{ matchCount, total, matchRate }`。

為了讓 `endSession` 有資料可比對，本次同步在 [../../convex/schema.ts](../../convex/schema.ts) 的 `bills` 表新增 optional `actualVotes` 欄位。這與後續 seed action 從 `data/ground-truth.json` 載入真實投票資料的方向相容。

### 修正：agentId 型別不對稱

`billVotes.agentId` 是 `v.id("agents")`（Convex 內部 ID），而 `bills.actualVotes[].agentId` 是 `v.string()`（外部 ground-truth 穩定 ID）。原始實作兩邊直接 `String()` 後比對，永遠不會 match。改以 `agents.profileRef` 作為 join key：seed ground-truth 時 `actualVotes[].agentId` 必須填入對應 agent 的 `profileRef` 字串。代價是每次 `endSession` 多一次 `agents.collect()`，PoC 規模可忽略。

## 3. TDD 流程

實作檔案：[../../tests/simulationCore.test.mjs](../../tests/simulationCore.test.mjs)

先新增測試，覆蓋下列行為：

- 相同 seed 的 RNG 產生相同序列。
- RNG 輸出維持在 `[0, 1)`。
- `decideVote` 對正、負、零 dot product 分別回傳 `yes`、`no`、`abstain`。
- `recordVoteHandler` 寫入 `billVotes`。
- `runTickHandler` 對 5 個 agents 產生 5 筆投票。
- `endSessionHandler` 在 5 筆中 4 筆吻合時回傳 `matchCount=4`、`total=5`、`matchRate=0.8`。

紅燈：

- 第一次執行 `npm test` 時，測試因 `convex/lib/rng.ts`、`convex/decideOnce.ts`、`convex/recordVote.ts`、`convex/runTick.ts`、`convex/endSession.ts` 尚不存在而失敗。
- 這確認測試確實捕捉 task 3 的缺口。

綠燈：

- 補上最小實作後，`npm test` 通過 8/8。
- 中途曾修正 Node ESM 直接匯入 `.ts` 時需要明確副檔名的問題。

## 4. 型別與 Convex 包裝

本次採用「handler + Convex wrapper」結構：

- handler 使用窄型別，方便 Node test 直接注入假的 `ctx.db`。
- Convex export 使用 `mutationGeneric` / `queryGeneric` 包裝 handler。
- `runTick` 與 `endSession` 的 Convex wrapper 透過薄轉接層呼叫 handler，避免尚未產生 `_generated` 時被卡住。

這個做法保留 TDD 可測性，也讓 `npx tsc -p convex/tsconfig.json` 可以通過。

## 5. 驗證結果

已通過：

```bash
npm test
npm run build
npm run lint
npx tsc -p convex/tsconfig.json
```

OpenSpec task 狀態已更新：

- `3.1` 已完成
- `3.2` 已完成
- `3.3` 已完成
- `3.4` 已完成
- `3.5` 已完成

目前 `poc-engineering-skeleton` 進度為 10/19。

## 6. 後續注意事項

- `actualVotes` 目前掛在 `bills` 表上，使用外部 stable `agentId` string，由 `endSession` 透過 `agents.profileRef` 解析到 Convex 內部 ID；後續 seed action 必須讓 `actualVotes[].agentId` 與對應 agent 的 `profileRef` 一致，否則比對會落為 0。
- `runTick` 目前遍歷所有 agents，尚未做 session scope 過濾；這符合目前 spec 的 5 agents PoC，但未來若 session 需要限定特定 agents，應新增 scope 欄位或查詢條件。
- `endSession` 目前只比對 `billsInScope[0]`，多 bill session 需要後續擴充。
- Phase A reasoning 是 deterministic 字串，Phase B LLM reasoning 與 `llmCallId` 將在後續 change 補上。
