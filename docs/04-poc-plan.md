# PoC 實作計畫

> 版本：1 ｜ 更新日期：2026-05-10 ｜ 狀態：current
> 對應缺口：[02-gaps.md #4 #6 #9 #10 #17](02-gaps.md)
> 目的：把現有設計文件壓進一個能跑、能驗證、能暴露問題的最小骨架；不再追加大而全的子系統設計
> 適用對象：研究者視角（見 [design/product-positioning.md](design/product-positioning.md)），遊戲開發者層延後

---

## 0. 為什麼是這份文件而不是更多設計文件

到 2026-05-10 為止，[02-gaps.md](02-gaps.md) 已解決 11/20 項，未解的多數是「形狀只能在實作時浮現」的問題：

- #9 容錯策略：壞 JSON、幻覺法案、逾時——寫文件預測不出真正會壞的形狀
- #6 ground truth：沒有 baseline，模擬「看起來合理」但無法驗證
- #4 選民層：5-agent PoC 規模下，opinionState 可以是 scalar，不需要先寫聚合模型
- #10 冷啟動 / #17 隨機種子：跑一次就會逼出來

結論：**先建 skeleton，邊跑邊補 failure-model.md，不要先寫**。

---

## 1. PoC 範圍鎖定

| 維度 | 範圍 | 排除 |
|------|------|------|
| 政治人物 Agent | 5 個（真實歷史人物，覆蓋至少 2 黨/派系） | 媒體 Agent、選民 Agent（見 §3） |
| 法案 | 1 個（ground truth 法案，見 §2） | 修正案家族、跨會期延續 |
| 會期 | 1 個 session，跑到該法案表決完畢 | 多會期、選舉週期 |
| 動作集 | `SPEAK`、`DECIDE_VOTE`、`REFLECT`（最小三件） | `LEAK_TO_MEDIA`、`AMEND_BILL`、所有灰色動作（#12 暫不做） |
| 資料層 | `agents` / `bills` / `sessions` / `billVotes` / `llmCallLog` | `mediaOutlets` / `newsItems` / `voterSegments` |
| 前端 | Observatory：agent 列表 / 法案狀態 / 投票結果 / 成本摘要 | stance drift 圖、event injection UI、遊戲介面 |
| LLM | 第一階段 mock，第二階段接真實 LLM | 多模型路由、批次推論 |

驗收條件單一且強硬：**對 ground truth 法案，5 個 agent 的模擬投票 vs 實際投票，吻合率 ≥ 4/5**（見 §2）。

---

## 2. Ground Truth 法案的選擇準則

不要從「哪部法案有趣」開始，從**可驗證性**反推。挑選準則（依序）：

1. **可考據性**：5 位政治人物對該法案有公開、可引用的發言或表決紀錄
2. **規模適中**：條文 ≤ 20 條，可放進單一 session 跑完
3. **立場有張力**：不是全院共識通過——否則模擬出「全部贊成」毫無資訊量
4. **時間可定位**：法案 + 5 位政治人物的活躍期能在同一時間窗對齊（[time-model.md §3](design/time-model.md) 的 session 邊界）
5. **資料密度**：質詢逐字稿、委員會紀錄、媒體報導其中至少兩項可取得

候選池（用戶自選）：

- 立法院公報資料庫的某個年度爭議法案
- 美國國會某個 roll-call vote（資料最齊，但人物 profile 較難用中文做八字）
- 香港立法會、德國聯邦議院等其他來源

**待用戶決定**：選哪部法案 + 哪 5 位政治人物。決定後寫進 §6 並建 `data/ground-truth.json`。

---

## 3. 為什麼選民層在 PoC 完全不做

[02-gaps.md #4](02-gaps.md) 列出「選民個體 vs 統計分布」的選擇，但在 5 agent + 1 bill 規模下：

- 議員的決策壓力主要來自**派系 + 個人意識形態 + 媒體聚光**（見 [media-model.md](design/media-model.md)）
- 選民影響在單一法案、單一會期內幾乎不變動
- 因此 `opinionState` 在 PoC 可以是**每個議員一個 scalar**（-1 ~ +1，初始化自 profile，session 內不更新）

等 PoC 跑通、要做多會期或選舉週期時再回頭設計 voter-model.md。

---

## 4. 工程骨架

### 4.1 技術選擇

- **後端**：Convex（schema + actions + scheduled functions）——對齊 [01-research.md](01-research.md) 既定方向，於 2026-05-10 確認不走 SQLite 過渡方案
- **前端**：純 React + Convex hooks，不引入額外 UI library
- **LLM 客戶端**：Anthropic SDK，模型先用 Haiku 4.5 控成本（見 [llm-cost-model.md](design/llm-cost-model.md)）
- **隨機種子**：所有 `Math.random()` 包進 `rng(seed)` helper，session 開始時固定 seed（解 #17）

### 4.2 最小資料表

對齊既有設計，但欄位砍到 PoC 必要：

```
agents          : id, name, profileRef, stanceVector, factionId, opinionState (scalar)
bills           : id, number, title, articles[], stanceVector, status
sessions        : id, startedAt, endedAt, seed, billsInScope[]
billVotes       : sessionId, billId, agentId, vote (yes/no/abstain), reasoning, llmCallId?
llmCallLog      : id, agentId, action, model, promptTokens, completionTokens, costUsd, latencyMs, ok, errorKind?
```

註：`mediaOutlets` / `newsItems` / `externalEvents` 表結構先建空、不寫入，避免之後 migration 痛苦。

### 4.3 核心函式

```
runTick(sessionId)        // 推進一個 tick，呼叫每個 agent 的 decideOnce
decideOnce(agentId, ctx)  // 第一階段 = mock 規則，第二階段 = LLM
recordVote(agentId, billId, vote, reasoning)
endSession(sessionId)     // 觸發比對 ground truth、寫入 PoC 驗收指標
```

### 4.4 兩階段切換

| 階段 | decideOnce 實作 | 目標 |
|------|----------------|------|
| Phase A | Mock：純規則 `vote = sign(dot(agent.stanceVector, bill.stanceVector))` | 跑通資料流、Observatory 能顯示、ground truth 比對流程 OK |
| Phase B | LLM：politician-skill prompt + 結構化輸出 | 暴露容錯問題、累積 failure-model.md |

切換點：Phase A 能完整跑完 session 並產出比對報告，才接 Phase B。

---

## 5. 容錯策略：邊跑邊累積，不預先設計

Phase B 啟動時，`decideOnce` 外面只包這四層：

1. **Schema validation**：用 zod 驗 LLM 回傳格式，失敗 → 重試 1 次 → 仍失敗則 fallback 到 Phase A 的規則決策
2. **引用檢查**：LLM 提到的 billId / articleNo 若不存在資料庫，標記 `errorKind: "hallucinated_reference"` 但不中斷
3. **逾時**：單次 LLM 呼叫 30s，逾時走 fallback
4. **全程記錄**：所有失敗寫進 `llmCallLog.errorKind`

每遇到一個新失敗形狀就在 `docs/design/failure-model.md`（屆時新建）追加一條，不預先猜。

---

## 6. 工作分解（建議執行順序）

| # | 任務 | 預估 | 卡關訊號 |
|---|------|------|---------|
| 1 | 用戶選定 ground truth 法案 + 5 位政治人物 | 半天 | 找不到 5 位都有公開立場的人 → 換法案 |
| 2 | 建 Convex schema（§4.2 五張表） | 半天 | — |
| 3 | 寫入 `data/ground-truth.json`（法案條文 + 5 位 profile + 實際投票） | 1 天 | 資料不齊 → 回 #1 |
| 4 | Phase A：mock decideOnce + runTick + endSession 比對 | 1 天 | — |
| 5 | Observatory 最小版（agent 列表、法案、投票結果、成本） | 1 天 | — |
| 6 | Phase B：接 LLM + 四層容錯 | 2 天 | 失敗率 > 50% → 暫停接 LLM，回頭調 prompt |
| 7 | 跑 10 次 session，看 ground truth 吻合率 + 隨機種子穩定性 | 半天 | 吻合率 < 4/5 → 不是收工而是進入下一階段分析 |
| 8 | 整理 failure-model.md（從 llmCallLog 反推） | 半天 | — |

> **進度（2026-06-01）**：任務 6 的**工程骨架已完成並 TDD 全綠**——`decideOnceLLM` 四層容錯、Anthropic(Haiku)/DeepSeek 雙 provider、`runTickLLM` action、leak-free persona、`failure-model.md` 骨架皆就位。尚缺：設定 Convex 金鑰後**實際跑一次真實 LLM session**，回填 failure-model 與吻合率（任務 7、8）。

任務 7 結束就是 PoC 完成點。**吻合率不是「達不到就失敗」**，而是「達到才有資格進入下一階段（多法案 / 媒體層 / drift 視覺化）」。

---

## 7. 不做清單（明確宣告）

| 項目 | 為什麼 PoC 不做 | 何時回來做 |
|------|----------------|-----------|
| 灰色政治動作（#12） | 倫理 + 因果追蹤 + 可見性同時膨脹 | Phase B 穩定後 |
| 媒體 Agent 完整實作 | media_spotlight 在單法案 PoC 可設常數 | 進入多法案後 |
| 選民層（#4） | 見 §3 | 多會期或選舉週期時 |
| 派系動態（#14） | factionId 先靜態 | 多會期 |
| stance drift 圖 | 單 session 內 drift 微小 | 多會期 |
| 遊戲介面 | 定位是研究者 | PoC 通過後 |
| 規則可配置性（#16） | hard-code 即可 | 第二個案例時 |

---

## 8. 待決事項

- [ ] §2 ground truth 法案 + 5 位政治人物選定（**用戶決定**）
- [x] ~~§4.1 是否真的用 Convex，或先用純 TypeScript + SQLite 跑通再遷移~~ → 2026-05-10 確認用 Convex
- [ ] §6 任務 7 的「10 次 session」次數是否合理（隨機種子穩定性需要更多次？）
- [ ] failure-model.md 在 PoC 完成時才寫，還是 Phase B 開始就建空檔逐條累積

---

## 9. 與既有文件的關係

- **不取代**任何 `design/*.md`，只是把它們的子集釘進 PoC 範圍
- **可能修正**：跑通後若發現某子系統設計與實作不符，回頭改 design 檔並升版
- **後續產出**：PoC 完成後新增 `docs/design/failure-model.md`、可能新增 `docs/design/voter-model.md`，並在 [02-gaps.md](02-gaps.md) 標記 #6 #9 #10 #17 的解決狀態
