# 文件索引

> 更新日期：2026-04-30

## 閱讀順序

新進入這份專案先照這個順序讀：

1. [00-conventions.md](00-conventions.md) — **動文件前必讀**：版號、命名、歸檔規範
2. [01-research.md](01-research.md) — 架構研究原文（總覽、分層、認知迴圈、壓力函數、PoC 場景）
3. [02-gaps.md](02-gaps.md) — 缺口分析（20 項待補項，每項標註「已解決／未解決」）
4. [03-project-references.md](03-project-references.md) — 三個本地參考專案的技術索引（模組路徑 × 缺口對應）
5. `design/` — 已釘下的子系統設計（每個子系統一份檔，當前版號）
6. `implementation-records/` — 實作紀錄（已完成 task 的落地內容與驗證方式）
7. `archive/` — 被取代的歷史版本（只看交叉引用時才需要）

---

## 文件地圖

```
docs/
├── README.md                       本檔（索引）
├── 00-conventions.md               文件撰寫規範（動檔前必讀）
├── 01-research.md                  架構研究原文（v1）
├── 02-gaps.md                      缺口分析（v1）
├── 03-project-references.md        參考專案技術索引（v1）
├── design/                         子系統設計（current 版本）
│   ├── bill-model.md               法案資料模型 v1
│   ├── time-model.md               時間／會期模型 v2（事件驅動）
│   ├── media-model.md              媒體與輿論層 v2（三通道）
│   ├── external-event-model.md     外部事件注入 v1（雙通道 + 稽核）
│   ├── politician-skill-contract.md  Politician-skill 整合合約 v1（欄位映射 + backbone 推導）
│   ├── observability-model.md       可觀測性模型 v1（三張表 + PoC 驗收指標）
│   ├── product-positioning.md       產品定位 v1（研究者 + 遊戲開發者，兩層介面）
│   └── bazi-model.md               八字命理人格補充層 v1（格局映射 + backbone 修正 + 大運時間修正器）
├── implementation-records/          實作紀錄（task 完成內容、驗證方式、後續注意事項）
│   ├── poc-engineering-skeleton-task-2.md  Convex schema task 2 實作紀錄
│   └── poc-engineering-skeleton-task-3.md  核心模擬函式 task 3 實作紀錄
└── archive/                        歷史版本（已被取代）
    └── design-priority-three.md    v1 三合一設計檔（§1 抽出至 bill-model；§2 §3 已被 v2 取代）
```

---

## 缺口解決狀態快查

對照 [02-gaps.md](02-gaps.md)：

| # | 缺口 | 狀態 | 對應檔 |
|---|------|------|--------|
| 1 | 法案資料模型 | ✅ 已解決 | [design/bill-model.md](design/bill-model.md) |
| 2 | 時間／會期模型 | ✅ 已解決 | [design/time-model.md](design/time-model.md) |
| 3 | 媒體 Agent 與輿論層 | ✅ 已解決 | [design/media-model.md](design/media-model.md) |
| 19 | 外部事件注入介面 | ✅ 已解決 | [design/external-event-model.md](design/external-event-model.md) |
| 4 | 選民層 | ⏳ 未解決 | — |
| 5 | PoC 關鍵指標 | ✅ 已解決 | [design/observability-model.md](design/observability-model.md) |
| 6 | ground truth／對標 | ⏳ 未解決 | — |
| 7 | LLM 成本估算 | ✅ 已解決 | [design/llm-cost-model.md](design/llm-cost-model.md) |
| 8 | Reflect 節流 | ✅ 已解決 | [design/llm-cost-model.md](design/llm-cost-model.md) |
| 9 | 容錯策略 | ⏳ 未解決 | — |
| 10 | 冷啟動 | ⏳ 未解決 | — |
| 11 | profile → Agent schema | ✅ 已解決 | [design/politician-skill-contract.md](design/politician-skill-contract.md) |
| 12 | 灰色地帶動作集 | ⏳ 未解決 | — |
| 13 | 資訊可見性模型 | ⏳ 未解決 | — |
| 14 | 派系動態 | ⏳ 未解決 | — |
| 15 | 倫理／責任邊界 | ⏳ 未解決 | — |
| 16 | 規則可配置性 | ⏳ 未解決 | — |
| 17 | 可重現性／隨機種子 | ⏳ 未解決 | — |
| 18 | 前端互動定位 | ✅ 已解決 | [design/product-positioning.md](design/product-positioning.md) |
| 20 | 八字命理人格補充層 | ✅ 已解決 | [design/bazi-model.md](design/bazi-model.md) |

---

## 前端 × Convex 接線

### 架構起始點

本專案有兩個起始點：

1. **前端**：`src/main.tsx` → `App.tsx` → 瀏覽器畫面
2. **後端**：`convex/` 資料夾 — 每個 `.ts` 檔 export 的 `query`/`mutation` 自動成為 API endpoint

### Convex Router 機制

Convex 沒有傳統 router，**檔案系統即路由**。呼叫路徑由 `convex/_generated/api.d.ts` 自動產生：

| 檔案 | export | 類型 | 呼叫路徑 |
|---|---|---|---|
| `convex/decideOnce.ts` | `decideOnce` | query | `api.decideOnce.decideOnce` |
| `convex/recordVote.ts` | `recordVote` | mutation | `api.recordVote.recordVote` |
| `convex/runTick.ts` | `runTick` | mutation | `api.runTick.runTick` |
| `convex/endSession.ts` | `endSession` | mutation | `api.endSession.endSession` |

### 前端呼叫後端

`src/main.tsx` 透過 `ConvexProvider` 接上 Convex backend：

```tsx
import { ConvexProvider, ConvexReactClient } from 'convex/react'
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)
```

元件內使用 hooks：

```tsx
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'

const result = useQuery(api.decideOnce.decideOnce, { ... })
const runTick = useMutation(api.runTick.runTick)
```

### 環境變數

需要在 `.env.local` 設定：

```
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
```

此值由 `npx convex dev` 自動產生。

---

## 本地資料目錄（`data/`）

- `data/` 已加入 [.gitignore](../.gitignore)，**不上 repo**
- 用途：存放本地 seed、產出快照、實驗紀錄等開發者個人資料
- 需要共享的範例資料請另外放入 `docs/` 或 `convex/` 對應位置，並在設計檔中說明來源

---

## 命名與版號規則

- **`NN-name.md`**：頂層的階段性文件，數字代表閱讀順序，不是版號
- **`design/<system>-model.md`**：子系統當前版本（無 v 字樣，當前即唯一）
- **檔頭 `> 版本：N`**：每份檔開頭用 blockquote 標版號、更新日期、狀態（current / archived / superseded）
- **取代舊檔**：舊檔搬到 `archive/`，新檔在開頭引用舊檔位置；不在檔名上掛 `-v2`
- **缺口索引**：所有設計檔的「對應缺口」一律指向 `02-gaps.md`，不指向其他設計檔
