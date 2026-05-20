# PoC Engineering Skeleton Task 2 實作紀錄

> 版本：1 ｜ 更新日期：2026-05-20 ｜ 狀態：current
> 來源：OpenSpec change `poc-engineering-skeleton` task 2
> 對齊：[../04-poc-plan.md](../04-poc-plan.md)、[../../openspec/changes/poc-engineering-skeleton/specs/convex-schema/spec.md](../../openspec/changes/poc-engineering-skeleton/specs/convex-schema/spec.md)
> 目的：記錄 Convex schema 骨架的實作內容、TDD 驗證方式與後續注意事項

---

## 1. 完成範圍

本次完成 OpenSpec task 2 的兩個子項：

- 2.1 建立 `convex/schema.ts`，定義 `agents`、`bills`、`sessions`、`billVotes`、`llmCallLog` 五張核心表。
- 2.2 在 schema 中加入 `mediaOutlets`、`newsItems`、`externalEvents` 三張佔位表。

這次只處理資料表定義，不包含 Convex functions、seed action、前端 `useQuery` 串接或 `npx convex dev` 部署。

## 2. Schema 設計

實作檔案：[../../convex/schema.ts](../../convex/schema.ts)

共用 validator：

- `stanceVector`：三維政策立場 `{ economic, environment, social }`，三個欄位皆為 number。
- `billStatus`：法案狀態 enum，允許 `introduced`、`in_committee`、`voting`、`passed`、`rejected`。
- `vote`：投票 enum，允許 `yes`、`no`、`abstain`。

核心表：

- `agents`：保存政治人物 agent 的基本資料、profile 參照、派系、立場向量與 `opinionState`。
- `bills`：保存法案編號、標題、條文陣列、法案立場向量與目前狀態。
- `sessions`：保存模擬 session 的開始時間、可選結束時間、seed，以及本 session 涵蓋的 bill ids。
- `billVotes`：保存單筆投票，連到 session、bill、agent，並記錄 vote、reasoning、可選 `llmCallId`。
- `llmCallLog`：保存 LLM 呼叫觀測資料，包含模型、token、成本、延遲、是否成功與可選錯誤分類。

佔位表：

- `mediaOutlets`
- `newsItems`
- `externalEvents`

三張佔位表目前使用空 schema，目的是讓資料庫先有表名，後續媒體、新聞、外部事件模型落地時再補欄位。

## 3. TDD 流程

實作檔案：[../../tests/convexSchema.test.mjs](../../tests/convexSchema.test.mjs)

先新增 Node 內建 test runner 測試，檢查：

- 五張核心表都以 `defineTable` 定義。
- 核心欄位存在。
- `stanceVector` 包含 `economic`、`environment`、`social` 三個 number 欄位。
- `billStatus` 與 `vote` enum literal 存在。
- 三張佔位表存在。

紅燈：

- 第一次執行 `npm test` 時，測試因 `convex/schema.ts` 不存在而失敗。
- 這確認測試確實捕捉 task 2 要補的缺口。

綠燈：

- 補上 `convex/schema.ts` 後重跑 `npm test`，測試通過。
- 中途曾調整測試，避免把共用 validator 的合法寫法誤判為失敗。

## 4. 相關配套

新增 `package.json` script：

```json
"test": "node --test"
```

修正 [../../convex/tsconfig.json](../../convex/tsconfig.json)，讓 `npx tsc -p convex/tsconfig.json` 能實際檢查 Convex 目錄。原本 `exclude: ["../**/*"]` 會把目前目錄也排除，導致 TypeScript 回報沒有輸入檔。

## 5. 驗證結果

已通過：

```bash
npm test
npm run build
npm run lint
npx tsc -p convex/tsconfig.json
```

OpenSpec task 狀態已更新：

- `2.1` 已完成
- `2.2` 已完成

目前 `poc-engineering-skeleton` 進度為 5/19。

## 6. 後續注意事項

- `llmCallLog.agentId` 目前依照 task 2 spec 設為必填；若後續需要記錄非 agent 呼叫，可參考 observability 設計再改成 optional。
- `mediaOutlets`、`newsItems`、`externalEvents` 是刻意保留的空表，不代表功能已完成。
- Convex schema 尚未透過 `npx convex dev` 部署，部署驗證屬於 OpenSpec task 6.2。
