# 多輪審議與 Agent 互動模型（Deliberation Model）

> 版本：1 ｜ 更新日期：2026-06-03 ｜ 狀態：proposal
> 對應缺口：[../02-gaps.md §14](../02-gaps.md)（派系動態過度簡化）、[§17](../02-gaps.md)（可重現性／隨機種子）
> 對齊：[failure-model.md](failure-model.md)（四層容錯）、[observability-model.md](observability-model.md)（matchRate 門檻）
> 目的：把 OASIS 式 agent-to-agent 互動接上現有單輪 LLM tick，且**不破壞 ground-truth 評分**

---

## 0. 與現行單輪 Phase B 的差異

現行 Phase B（[runTickLLMHandler.ts](../../convex/lib/runTickLLMHandler.ts)）是**單輪、互不影響**：遍歷每位 agent → 各自看自己的側寫與法案 → 投一票。沒有 agent 之間的互動。本模型在外面包一層「輪次迴圈」，讓 agent 看到別人上一圈的發言後可以轉向，逼近真實立院的黨團協商動態。

| 項目 | 單輪（現況） | 多輪審議（本模型） |
|------|------|------|
| agent 互動 | 無 | 有（經 digest 互看上一圈發言） |
| token 成本 | 1× | 至多 ~R× + 每圈一次主席總結 |
| 真實感（黨團轉向、從眾） | 無 | 有 |
| matchRate | 已知 baseline | **待證**——可能升（往黨團路線收斂）也可能降（從眾到錯的共識） |
| 失敗面 | 四層容錯 | + 「digest 失敗降級」與「輪間凍結」 |
| 種子穩定性 | 高（單次 LLM） | 受生成式 digest 影響（見 §4） |

> **核心立場**：互動本身不是目的，**提升 matchRate 才是**。本模型內建 A/B 守門員（§7）——多輪版吻合率必須 ≥ 單輪 baseline，否則就是花更多 token 買更逼真的錯誤，正是本專案要避開的 MiroFish 陷阱。

---

## 1. 多輪審議迴圈

在 [runTickLLMHandler.ts](../../convex/lib/runTickLLMHandler.ts) 既有的「遍歷 agent」之外，再包一層輪次迴圈：

```
round 0:  每位 agent 各自決策（= 現行 Phase B，無 digest）
          產出：vote + statement（公開理由）

round r (r ≥ 1，同圈內可並行):
  1. 主席總結 LLM(temperature=0，只吃「上一圈」所有 statements) → digest
       ↳ 失敗 / 逾時 → 規則式派系聚合 digest（決定性 fallback，見 §2）
  2. 每位 agent 讀這份共用 digest（看上一圈，並行）→ 改投 + 產出新 statement
  3. 收斂判定：本圈全員票 == 上一圈全員票 → 停，commit 本圈為最終票

  上限 R = 5（不收斂就跑到第 5 圈為止）

評分：只有最終圈的票寫進評分路徑，由 endSession 比對 ground truth
```

- **round 0 即現行行為**——這天然就是 §7 A/B 的 `R=1` baseline。
- 每位 agent 的決策仍走 [decideOnceLLM.ts](../../convex/lib/decideOnceLLM.ts) 的四層容錯，只是 prompt 多注入一段 digest、回傳多一個 `statement`。

---

## 2. digest 生成

`digest` = 把「上一圈所有 agent 的發言」壓縮後，餵進下一圈每位 agent prompt 的那段文字。N 個 agent 全文互看是 O(N²) token 且雜訊大，故需摘要。

### 2.1 PoC 採用：生成式主席總結 + 規則式降級

- **主流路徑（生成式）**：另開一次 LLM 呼叫，把本圈全員 statement 濃縮成一段「主席總結」。`temperature=0` 以盡量壓低非決定性。**全場共用一份**（非每位 agent 一份），每圈只多 1 次呼叫。
- **降級路徑（規則式）**：主席總結逾時／失敗 → 退回純 code 的**派系聚合**：依 `factionId` 分組，輸出「某黨團多數傾向 X（n/m），代表理由：…」。決定性、零成本、最易稽核。

這讓「生成式 digest」的安全網是「規則式 digest」，完美套進 [failure-model.md](failure-model.md) 的容錯哲學。

### 2.2 六種摘要做法對照（為何選生成式 + 規則式 fallback）

| 做法 | 成本 | 可重現 | leak 風險 | 真實感 |
|------|------|--------|-----------|--------|
| 1 全文廣播 | 高（O(N²)） | ✅ | 低 | 中（吵） |
| 2 規則式聚合 | ~0 | ✅✅ | 最低 | 中 |
| 3 抽取式（Top-K） | 低 | 看規則 | 低 | 中 |
| **4 生成式（主席總結）** | 中（+1/圈） | ✗（temp=0 緩解） | 中 | 高 |
| 5 分眾（per-recipient） | 高（+N/圈） | 看實作 | 中 | 最高 |
| 6 記憶式（Zep/反思） | 最高 | ✗ | 中高 | 最高 |

PoC 取**做法 4 為主、做法 2 為降級**：真實感最高，且失敗時退回最穩的決定性版本。做法 5、6 的真實感增益留待驗證「互動有效」之後再加（見 §9）。

---

## 3. 收斂判定與上限

- **收斂條件**：本圈每位 agent 的票，與上一圈完全相同 → 視為收斂，停止迴圈，commit 本圈為最終票。
- **上限**：`R = 5`。即使未收斂，跑到第 5 圈也強制定案。
- **下限**：至少 2 圈（round 0 + round 1），因為收斂判定需要至少一次「與上一圈比對」。
- **不收斂**：到 R=5 為止，直接取第 5 圈的票。不視為失敗（真實協商也未必收斂）。

> 注意：生成式 digest 非決定性，即使 `temperature=0` 仍可能有微小翻動，使收斂判定毛躁；上限 R=5 是防止「永遠差一票」空轉的保險。

---

## 4. 並行時序與可重現性

- **時序：並行（看上一圈）**。同一圈內，所有 agent 讀的是「上一圈定版」的同一份 digest，彼此同時決策、互不可見本圈發言。等同「同時舉手表決」。
  - 好處：可並發加速（5 個 agent 同時跑）、且順序不影響結果 → 利於重現。
  - 對照「序列（即時）」：後發言者看得到前面本圈剛說的——更像真實異議，但順序影響結果、無法並發、傷種子穩定性。本模型**不採用**。
- **可重現性衝擊**：生成式 digest（§2）是非決定性來源。`temperature=0` 把抖動降到最低，但**無法像規則式 digest 那樣 100% 重現**。這是選做法 4 換取真實感所付的明確代價，於 §7 A/B 中以「多次跑取平均 + 觀察 matchRate 離散度」吸收。

---

## 5. Leak-free 不變式（不可違反）

1. **只有最終票進評分**——[endSession](../../convex/endSession.ts) 仍只比對每位 agent 的最後一票 vs ground truth；中間圈的票與發言不計分。
2. **全程不見答案卷**——任何一圈的任何 prompt 都不得含真實投票結果或投票日後資訊，沿用 [decisionPrompt.ts](../../convex/lib/decisionPrompt.ts) 的 leak-free 約束。
3. **可降級**——任一圈 LLM 失敗，該 agent 凍結於上一圈立場；全圈失敗回 Phase A 點積（[decideOnceLLM.ts](../../convex/lib/decideOnceLLM.ts) 四層容錯）。

### digest 也必須 leak-free

digest 由「agent 模擬發言」組成，發言來自看不到答案卷的 agent，故輸入天生乾淨。**但**主席總結器（§2）是 prompt 路徑上多出來的一個 LLM，必須 by construction 保證其輸入**只含本圈 statements**，絕不傳整個 bill doc（含 `actualVotes`）。

> **反例（必須避免）**：若為省事讓摘要器讀了 bill 的 `actualVotes`，寫出「根據實際表決，多數反對本案」——這一句把答案漏進每位 agent 的下一圈 prompt → 全體開始抄答案 → matchRate 瞬間造假、毫無意義。這正是本專案與 MiroFish 的根本分野。

---

## 6. Schema delta（最小，本文件僅釘定、不實作）

```typescript
// billVotes 增加
round: v.number(),                  // 第幾輪的這一票（最終票 = 收斂圈）
statement: v.optional(v.string()),  // 該圈公開發言（供下一圈 digest 取材）

// llmCallLog 增加
round: v.number(),                  // 成本按圈歸因（成本隨 R 線性成長，要看得到）
```

- 不開新表，沿用 [recordDecisionHandler.ts](../../convex/lib/recordDecisionHandler.ts) 既有「先寫 llmCallLog 再寫連結的 billVote」路徑。
- [queries.ts `sessionStats`](../../convex/queries.ts) 的 join 可自動按 `round` 彙整每圈的真 LLM / fallback / 成本。
- 主席總結那次呼叫亦寫一筆 `llmCallLog`（`action: "deliberationDigest"`），與 agent 決策呼叫區分。

---

## 7. 驗證：A/B 守門員

接進 [verifyPhaseB.ts](../../convex/verifyPhaseB.ts)，跑兩組對照：

| 組別 | 設定 | 量測 |
|------|------|------|
| baseline | R=1（現行單輪） | `matchRate(R=1)` |
| 審議 | 收斂即停，上限 R=5 | `matchRate(多輪)`、平均圈數、額外成本 |

**通過條件**：

1. `matchRate(多輪) ≥ matchRate(R=1)`——互動沒讓準度變差（最好變好）。
2. 額外 token 成本在可接受範圍（成本按圈歸因，見 §6）。
3. 呼應 [observability-model.md](observability-model.md)：整體仍須維持 `behavior_consistency_score ≥ 0.70`。

> 任一條不過，代表「多輪審議」對本 PoC 無正向價值，應退回單輪或調整 digest 策略，而非硬上。

---

## 8. Tradeoff 總表

| 決策點 | 選項 | 取捨 | 本模型選擇 |
|--------|------|------|-----------|
| R 定義 | 固定 R / 收斂即停 | 固定=可預測；收斂=省 token 但成本浮動 | **收斂即停，上限 5** |
| digest 做法 | 全文/規則/抽取/生成/分眾/記憶 | 真實感 ↔ 成本/可重現/leak 風險 | **生成式 + 規則式 fallback** |
| 時序 | 並行 / 序列 | 並行可重現可並發；序列更真實但不可重現 | **並行（看上一圈）** |
| 記憶 | 無狀態 / 持久 | 無狀態夠用；持久重且傷重現 | **無狀態**（持久留 P3） |

---

## 9. 待決事項

1. **`statement` 產出格式**——要不要限長或結構化（如 `{stance, keyArgument, citedArticles}`），以利主席總結與規則式聚合取材？
2. **digest 抑縮長度上限**——主席總結最多幾字 / 幾 token，避免下一圈 prompt 膨脹。
3. **分眾 digest（§2 做法 5）**——每位 agent 拿到客製化 digest（模擬同溫層／選擇性注意），留待「互動有效」驗證後評估。
4. **持久記憶（§2 做法 6 / Zep）**——跨會期記憶與反思，列為 **P3**。
5. **「輪間凍結」精確語意**——某 agent 某圈失敗時，凍結於「上一圈票」還是「round 0 票」？對收斂判定的影響需釘死。
