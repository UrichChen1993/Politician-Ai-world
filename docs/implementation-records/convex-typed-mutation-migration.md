## Convex `mutationGeneric` → `mutation` 遷移紀錄

> 版本：1 ｜ 更新日期：2026-05-21 ｜ 狀態：current
> 範圍：`convex/runTick.ts`、`convex/recordVote.ts`、`convex/endSession.ts`、`convex/decideOnce.ts`

---

## 1. 背景

PoC 初版核心函式檔（task 3 產出）使用 `mutationGeneric` / `queryGeneric` 並手刻 `AgentDoc / BillDoc / SessionDoc / QueryableDb / InsertableDb / EndSessionDb` 等介面，原因是當時尚未執行 `npx convex dev`，`convex/_generated/` 不存在，無法 import schema-aware 的 `mutation` / `query`。

執行 `npx convex dev` 後 `convex/_generated/`（含 `server.d.ts` 與 `dataModel.d.ts`）已產生，可改用 schema-aware 版本，讓 `ctx.db.get/insert/query` 由 [convex/schema.ts](../../convex/schema.ts) 自動推導出 `Doc<"agents">` 等 strict 型別。

## 2. 為什麼要換

- **單一事實來源**：schema 改動會直接讓使用端編譯失敗，免去手刻型別與 schema 漂移的風險。
- **減少 cast**：原本 `ctx as unknown as { db: QueryableDb }` 屬於繞過型別檢查的 workaround，正式 codegen 後可逐步移除。
- **執行期/編譯期一致**：`mutation` 的 args validator 與 `ctx.db.insert` 的 table 名稱、文件形狀皆由 schema 強制，runtime 驗證與 TS 型別同步。

## 3. 修改方向（本次採最小變更）

| 檔案 | 變更 |
|---|---|
| [convex/runTick.ts](../../convex/runTick.ts) | `import { mutationGeneric } from "convex/server"` → `import { mutation } from "./_generated/server"`；`mutationGeneric({...})` → `mutation({...})` |
| [convex/recordVote.ts](../../convex/recordVote.ts) | 同上；另把 `handler: recordVoteHandler` 改為 wrapper `async (ctx, args) => recordVoteHandler(ctx as unknown as { db: InsertableDb }, args)`，原因見下節 |
| [convex/endSession.ts](../../convex/endSession.ts) | 同 runTick.ts |
| [convex/decideOnce.ts](../../convex/decideOnce.ts) | `queryGeneric` → `query`；handler 顯式標註 `args: { agentStanceVector: StanceVector; billStanceVector: StanceVector }`，避免 strict 模式下 `_ctx / args` 被推斷成 `any` |

handler 內部手刻型別（`AgentDoc / BillDoc / SessionDoc / QueryableDb / InsertableDb / EndSessionDb`）**全部保留**，理由是：

- 這些 handler 同時被單元測試以 mock ctx 直接呼叫，型別需描述測試實際使用的最小介面，而不是完整 `MutationCtx`。
- 若直接把 handler 型別綁成 `MutationCtx`，現有 mock-based 單元測試會需要全面改寫成 `convex-test` 或注入完整 ctx，超出本次範圍。

因此 mutation/query wrapper 與 handler 之間透過 `ctx as unknown as { db: ... }` 的 cast 連接 —— 用 wrapper 一層擋住 strict 型別，handler 內部保有可測試的窄介面。

## 4. recordVote 為何需要包 wrapper

`mutation` 從 `_generated/server` 帶來的 `ctx.db.insert("billVotes", doc)` 的 `doc` 必須符合 schema 對 `billVotes` 的形狀（`sessionId / billId / agentId / vote / reasoning` 都是必填）。原 `recordVoteHandler` 的 `InsertableDb.insert` 簽名是 `(table, doc: Record<string, unknown>)`，兩者不相容，無法把 handler 直接當成 `mutation` 的 handler 傳入。

最小修法是與其他三檔一致 —— 包一層 wrapper 在 wrapper 內 cast，把 strict ctx 退回成 handler 預期的窄介面。

## 5. 已驗證

- `npx tsc --noEmit -p convex/tsconfig.json` 通過，無錯誤。
- 既有單元測試未動，handler 簽名不變。

## 6. 附錄：Convex `query` / `mutation` / `action` 三者差異

Convex server function 分三種 builder，差別在能做什麼、在不在 transaction 內、能不能碰外部世界。

### 對照表

| Builder | 讀 DB | 寫 DB | 外部 API（fetch / LLM / 第三方） | Transaction | 典型用途 |
|---|---|---|---|---|---|
| `query` | ✅ | ❌ | ❌ | read snapshot（一致性快照） | 讀資料、給前端即時訂閱 |
| `mutation` | ✅ | ✅ | ❌ | ✅ ACID（失敗自動 rollback、衝突自動 retry） | 所有資料庫寫入 |
| `action` | 透過 `ctx.runQuery` | 透過 `ctx.runMutation` | ✅ | ❌（非 deterministic） | 呼叫 LLM、HTTP、寄信、其他副作用 |

### 三者各自的 `ctx` 重點

- **`query` ctx**：`ctx.db`（read-only `DatabaseReader`）、`ctx.auth`。`ctx.db.insert/patch/delete` 不存在。
- **`mutation` ctx**：`ctx.db`（`DatabaseWriter`，可讀寫）、`ctx.auth`、`ctx.scheduler`（排程 mutation/action）、`ctx.storage`。
- **`action` ctx**：沒有 `ctx.db`；必須透過 `ctx.runQuery(api.x.y, args)` / `ctx.runMutation(api.x.y, args)` 間接讀寫。可自由 `fetch()` 或呼叫任意 SDK。

### 為什麼這樣切

Convex 的 `mutation` 要求 handler 是 **deterministic**，才能在 transaction 內 retry、做 reactive query 失效推播。因此：

- `mutation` 內不准 `fetch` / `Date.now()` 以外的非確定性副作用 → 凡是會打外部 API 的事都得搬去 `action`。
- `query` 一旦能寫入就會破壞快照一致性 → 讀寫嚴格分離。
- `action` 因為要打外部 API，本身不能在 transaction 裡 → 要寫資料必須委派給 `mutation`。

### 典型流程：LLM 投票

本專案 Phase B 之後的 LLM 投票會長這樣（Phase A 因為純規則計算，整段塞在 mutation 內就夠）：

1. 前端／scheduler 觸發 `action runLlmTick`
2. action 先 `ctx.runQuery` 撈出 agent / bill 的 stance / profile
3. action `fetch` LLM API 拿到投票結果與 reasoning
4. action `ctx.runMutation` 呼叫 `recordVote`，把結果寫進 `billVotes` + `llmCallLog`

整個鏈條的「寫」永遠只發生在步驟 4 的 mutation 內 —— ACID 保證一筆 LLM 呼叫對應的所有資料一起成功或一起失敗。

### 對應到目前 PoC

| 檔案 | builder | 為何選這個 |
|---|---|---|
| [convex/decideOnce.ts](../../convex/decideOnce.ts) | `query` | 純函式計算 + 不寫 DB |
| [convex/recordVote.ts](../../convex/recordVote.ts) | `mutation` | 寫入 `billVotes` |
| [convex/runTick.ts](../../convex/runTick.ts) | `mutation` | 批次寫入多筆 `billVotes`，需 ACID |
| [convex/endSession.ts](../../convex/endSession.ts) | `mutation` | `patch` session.endedAt + 讀 ground truth 比對 |
| （未來）LLM 投票 | `action` + `mutation` | LLM `fetch` 在 action，寫入委派回 mutation |

### 一句話速記

> 讀用 `query`、寫用 `mutation`、碰外部世界用 `action`。需要寫 DB 又要打外部 API → action 呼叫 mutation。

---

## 7. 後續可選清理（未做）

- 把 handler 全面改用 generated 型別（`MutationCtx`、`Doc<"agents">`、`Id<"sessions">`），刪除手刻介面與所有 `as unknown as` cast。
- 對應改寫單元測試為 `convex-test` 或最小化的 strict ctx mock。
- 若決定走這條路，建議當作獨立 task 處理，避免與本次 schema 對齊混在一起。
