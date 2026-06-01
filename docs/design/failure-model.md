# 容錯模型（Failure Model）

> 版本：1 ｜ 更新日期：2026-06-01 ｜ 狀態：current
> 對應缺口：[../02-gaps.md #9](../02-gaps.md)｜對應計畫：[../04-poc-plan.md §5](../04-poc-plan.md)
> 目的：記錄 Phase B 接 LLM 後**實際遇到**的失敗形狀，逐條累積。不預先猜——只記真的壞過的東西。

---

## 0. 原則

poc-plan §5 的決定：容錯策略「邊跑邊累積，不預先設計」。本文件是那句話的落地。

- `decideOnceLLM` 永不拋例外：任何失敗都降級成 Phase A 點積決策，並在 `llmCallLog.errorKind` 留痕。
- 每個 `errorKind` 對應一種已知失敗形狀。新形狀出現 → 在 §2 新增一條。
- 分析時用 `llmCallLog` 反推：哪種 errorKind 最高頻、是否集中在特定 agent / 特定法案。

---

## 1. 四層容錯（已實作）

對齊 poc-plan §5，包在 `decideOnceLLM`（[convex/lib/decideOnceLLM.ts](../../convex/lib/decideOnceLLM.ts)）外的四層：

| 層 | 機制 | 失敗時行為 |
|----|------|-----------|
| 1. Schema validation | `parseDecisionResponse` 驗 JSON 形狀（vote 列舉、reasoning 非空） | 拋 `DecisionParseError` → 重試 1 次 → 仍失敗則 fallback |
| 2. 引用檢查 | `checkReferences` 比對 citedArticles vs 法案實際條號 | **非致命**：保留投票，標記 `hallucinated_reference` |
| 3. 逾時 | `callWithTimeout`（預設 30s，可注入） | 中止呼叫 → fallback |
| 4. 全程記錄 | 每次決策寫一筆 `llmCallLog`（tokens / cost / latency / ok / errorKind） | — |

Fallback = Phase A 點積：`vote = sign(dot(agentStance, billStance))`，reasoning 標 `[fallback]`。

---

## 2. 已知失敗形狀（errorKind 分類）

| errorKind | 觸發條件 | 致命？ | 處置 | 觀察到的實例 |
|-----------|---------|--------|------|------------|
| `schema_validation_failed` | 重試後仍無法解析成合法決策 JSON | 是 | fallback 到點積 | _（待 Phase B 跑後填）_ |
| `timeout` | 單次呼叫超過 timeoutMs | 是 | fallback 到點積 | _（待填）_ |
| `llm_request_failed` | client 拋例外（網路 / API 4xx-5xx） | 是 | fallback 到點積 | _（待填）_ |
| `hallucinated_reference` | 引用了法案不存在的條號 | 否 | 保留投票，僅標記 | _（待填）_ |
| `unknown_error` | 未分類例外 | 是 | fallback 到點積 | _（待填）_ |

> 「觀察到的實例」欄在第一次跑完真實 LLM session 後回填：貼上實際 prompt 片段 + 壞掉的回傳 + 出現頻率。

---

## 3. 待累積（跑真實 LLM 後）

- [ ] 跑一次 `runTickLLM`，從 `llmCallLog` 統計各 errorKind 頻率
- [ ] 記錄最常見的壞 JSON 形狀（是缺欄位？多包 markdown？還是中英混雜？）
- [ ] 確認 fallback 率：理想 < 10%；若某 agent 持續 fallback，看是 prompt 還是模型問題
- [ ] 比對 Haiku vs（若切換）DeepSeek 的失敗形狀差異
- [ ] 視實況決定是否需要第 5 層（如：reasoning 與 vote 矛盾的語意檢查）
