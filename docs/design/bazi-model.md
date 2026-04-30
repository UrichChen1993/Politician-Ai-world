# 八字命理人格補充層

> 版本：1 ｜ 更新日期：2026-04-30 ｜ 狀態：current
> 對應缺口：[../02-gaps.md §20](../02-gaps.md)
> 對齊：[politician-skill-contract.md](politician-skill-contract.md)（backbone 公式 §3.2、skillMd 注入 §5）
> 目的：定義八字命理分析如何作為政治人物人格初始化的補充來源，包含輸出格式、欄位映射、backbone 修正規則與大運時間修正器

---

## 0. 為什麼需要八字層

Politician-skill 的六軌研究依賴公開紀錄（投票、發言、媒體）推導人格。當資料不足（新人、地方議員、歷史人物）時，backbone 只能用 `DEFAULT_BACKBONE = 0.4` 兜底，style tag 也無從偵測。

八字提供一條**獨立於公開紀錄的人格推導路徑**：從生辰資料推算五行分布、格局、十神，再映射為人格特質與壓力耐受傾向。它不取代六軌研究，而是：

1. **資料不足時的起點估算**：backbone 推導的第四個來源（補進 §3.2 公式）
2. **定性人格的文字語境**：注入 system prompt，豐富 LLM 對 Agent 行為的理解
3. **大運時間修正器**：依命理週期動態調整 backbone 加成，配合 [time-model.md](time-model.md) 的 per-tick decay

---

## 1. 輸出物：bazi.md

Politician-skill 在每位政治人物目錄下新增一份可選檔案：

```
politicians/<slug>/
  meta.json
  political.md
  persona.md
  limitations.md
  bazi.md          ← 新增（可選）
  research/
```

### 1.1 bazi.md 結構

```markdown
# 八字命理：<姓名>

## 基本資料
- 生辰：YYYY-MM-DD HH:MM（公曆）
- 性別：男／女
- 資料可信度：confirmed / estimated / unknown

## 四柱命盤

| 柱 | 天干 | 地支 | 十神 | 藏干（主/中/餘） |
|----|------|------|------|----------------|
| 年 | 甲   | 子   | 偏印 | 癸             |
| 月 | 丙   | 午   | 食神 | 丁／己          |
| 日 | 壬   | 申   | —   | 庚／壬／戊      |
| 時 | 庚   | 辰   | 偏官 | 戊／乙／癸      |

日主：壬水（陰水）
身強／身弱：身強

## 五行分布

| 五行 | 計數 | 強弱 |
|------|------|------|
| 木   | 0    | 缺   |
| 火   | 2    | 旺   |
| 土   | 2    | 平   |
| 金   | 2    | 平   |
| 水   | 2    | 平   |

喜用神：金、土（身強需洩剋）
忌神：水、木

## 格局

主格：偏官格（七殺格）
副格：食神制殺

## 大運

起運年齡：N 歲（YYYY 年起運）

| 大運序 | 干支 | 起迄年份 | 五行屬性 | 喜忌 |
|--------|------|----------|----------|------|
| 1      | 辛卯 | 2025-2034 | 金木     | 喜（金）忌（木） |
| 2      | 庚寅 | 2035-2044 | 金木     | 喜（金）忌（木） |
| ...    |      |          |          |      |

## 人格映射摘要

> 本段是給 LLM 讀的定性描述，不是計算輸出。

七殺格日主身強：決斷力強，抗壓性高，傾向對抗威權而非臣服。
食神制殺：具備將衝突轉化為成果的能力，不蠻幹。
缺木：創新彈性稍弱，固守已知路徑；若大運走木則補此缺陷。
忌神為水：同類相爭強烈時易衝動決策，需警覺。

backbone 傾向：高（七殺格 + 身強）
style tag 傾向：強斷言
```

---

## 2. 欄位映射：bazi.md → Agent Schema

### 2.1 格局 → style tag（用於 backbone §3.2 修正項）

| 主格 | style tag 修正 | 說明 |
|------|---------------|------|
| 七殺格（偏官格） | `強斷言` +0.10 | 決斷、對抗，不妥協 |
| 傷官格 | `強斷言` +0.10 | 叛逆、自信，藐視體制 |
| 食神格 | `共識導向` −0.10 | 和諧、給予，不喜衝突 |
| 正官格 | `共識導向` −0.05 | 遵規、尊階，傾向妥協 |
| 正財格 | 無修正 | 務實，中性 |
| 偏財格 | 無修正 | 靈活，中性 |
| 印格（正印／偏印） | `共識導向` −0.05 | 學術型，避免對抗 |

### 2.2 身強弱 → backbone 起點修正

| 身強弱 | backbone 偏移 |
|--------|--------------|
| 身強 / 從強 | +0.05 |
| 中和 | 0.00 |
| 身弱 / 從弱 | −0.05 |

這個偏移作用在 [politician-skill-contract.md §3.2](politician-skill-contract.md) 的 style 修正項上，不獨立計算，仍在 `clip(0.1, 0.9)` 範圍內。

### 2.3 backbone 公式擴充（加入第四來源）

原公式（politician-skill-contract.md §3.2）：

```python
backbone = (
    0.6 * party_deviation_rate
    + 0.3 * independence_score
    + 0.1 * (0.5 + style_bonus + style_penalty)
)
```

加入八字修正後，`style_bonus` / `style_penalty` 的來源擴充：

```python
# 原有：from meta_json(slug, "tags.style")
style_bonus  = 0.10 if "強斷言" in style_tags else 0.0
style_penalty = -0.10 if "共識導向" in style_tags else 0.0

# 新增：從 bazi.md 推導（若檔案存在）
if bazi_exists(slug):
    bazi_bonus, bazi_penalty = derive_style_from_bazi(slug)
    # 若六軌研究已有 style tag，bazi 結果權重減半（避免重複計算）
    weight = 0.5 if style_tags else 1.0
    style_bonus  += bazi_bonus  * weight
    style_penalty += bazi_penalty * weight
```

> **為什麼不開新欄位？**  
> backbone 公式的 style 修正項原本就是「細節校正」用途，語意完全吻合；開新欄位反而讓公式難以維護。

### 2.4 人格映射摘要 → system prompt 注入

`人格映射摘要` 段落的文字作為 `baziMd` 欄位，在 Agent 的 LLM 呼叫時與 `politicalMd`、`personaMd` 一起注入：

```typescript
agents: defineTable({
  // ...既有欄位...
  baziMd: v.optional(v.string()),  // bazi.md §人格映射摘要（可選）
})
```

注入時位置：排在 `personaMd` 之後，加上前置說明：

```
[八字命理補充 — 此為命理分析，不代表確定性格，僅供行為傾向參考]
<baziMd 內容>
```

---

## 3. 大運時間修正器

大運（10 年一換的命理週期）可與 [time-model.md](time-model.md) 的 tick 系統整合，在特定時間區間內對 backbone 施加動態加成。

### 3.1 映射邏輯

```python
def get_dayun_backbone_modifier(slug: str, current_year: int) -> float:
    """
    讀取 bazi.md 的大運表，找出 current_year 所在的大運，
    根據該大運的喜忌判斷 backbone 修正值。
    """
    dayun = find_current_dayun(slug, current_year)
    if dayun is None:
        return 0.0

    favorable_elements = get_xiyongshen(slug)  # 喜用神
    unfavorable_elements = get_jishen(slug)     # 忌神

    overlap_favorable = len(dayun.elements & favorable_elements)
    overlap_unfavorable = len(dayun.elements & unfavorable_elements)

    # 每個喜用元素 +0.03，每個忌神元素 −0.03，上限 ±0.10
    modifier = (overlap_favorable - overlap_unfavorable) * 0.03
    return max(-0.10, min(0.10, modifier))
```

### 3.2 套用時機

大運修正器在 **session open** 時計算一次（不是每 tick），存入 `stances.baziModifier`：

```typescript
stances: defineTable({
  // ...既有欄位...
  baziModifier: v.optional(v.number()),  // 大運當前週期修正（−0.10 ~ +0.10）
})
```

`effectiveBackbone` 在壓力函數中計算：

```python
effective_backbone = clip(agent.backbone + agent.baziModifier, 0.05, 0.95)
```

**為什麼不直接改 backbone？**  
`backbone` 是從研究資料推導的「基線」，大運修正是「當下週期加成」，語意不同。分開儲存讓可觀測性 dashboard 能區分兩者貢獻。

---

## 4. 資料可信度處理

bazi.md 的 `資料可信度` 欄位控制各項映射的啟用：

| 可信度 | backbone style 修正 | 人格摘要注入 | 大運修正器 |
|--------|--------------------|-----------|---------  |
| `confirmed`（確認生辰） | ✅ 全用 | ✅ | ✅ |
| `estimated`（推算生辰） | ✅ 但 weight × 0.5 | ✅（加免責標示） | ❌ |
| `unknown`（生辰不確定） | ❌ | ❌ | ❌ |

---

## 5. 與既有設計的邊界

| 關切點 | 本文件的立場 |
|--------|------------|
| 八字取代六軌研究？ | 不。六軌研究仍是主要來源；八字是可選補充 |
| 不信命理的用戶？ | `baziMd` 注入加上免責標示；backbone 修正量小（上限 ±0.10），不決定性改變結果 |
| 政治人物生辰隱私？ | 只使用公開或本人公開的生辰；私人推算不列入 confirmed |
| 歷史效度驗證？ | 在 [observability-model.md](observability-model.md) 的 `behavior_consistency_score` 中可比較：有無 bazi 修正的 Agent 投票一致性差異 |

---

## 6. PoC 最小實作

| 步驟 | 內容 | 前提 |
|------|------|------|
| 1 | 為賴清德或一位測試人物完成 bazi.md（含四柱、格局、大運、人格摘要） | 需確認生辰資料 |
| 2 | 實作 `derive_style_from_bazi(slug)` → style 修正值 | bazi.md 存在 |
| 3 | 在 agents 表加 `baziMd` 欄位，初始化時注入人格摘要 | Convex schema 更新 |
| 4 | 實作 `get_dayun_backbone_modifier()` + `baziModifier` 欄位 | 大運表完整 |
| 5 | 在可觀測性 dashboard 加「bazi modifier 當前值」監控欄 | observability-model §2 |

---

## 7. 八字分析工具規範

### 7.1 工具來源

使用 **`bazi-zh` Skill**，位於：

```
D:\work\Playground\bazi-skill\.claude\skills\bazi-zh\
```

在 Claude Code 中以 `/bazi` 指令呼叫。Skill 包含：

| 參考文件 | 內容 |
|---------|------|
| `references/wuxing-tables.md` | 天干、地支、五行、十神對照表 |
| `references/shichen-table.md` | 時辰對照表（含地方時修正） |
| `references/dayun-rules.md` | 大運排法、起運年齡計算、流年分析規則 |
| `references/classical-texts.md` | 窮通寶典、三命通會、滴天髓等古典命理核心判斷規則 |

### 7.2 調用時機

收集政治人物或建立模擬人物時，凡 `資料可信度 ≠ unknown` 即應建立 `bazi.md`。具體觸發點：

1. **`create-politician` Skill 執行中**：六軌研究完成後，若能取得生辰（公開或本人公開），在 `research/` 產出的同時，調用 `/bazi` Skill 補上第七軌。
2. **模擬人物初始化**：以虛構設定生成人物時，可由設計者指定（或隨機生成）生辰，調用 `/bazi` Skill 產生初始人格傾向，確保新人 backbone 不落入 `DEFAULT_BACKBONE = 0.4` 同質化。

### 7.3 調用流程

```
1. 呼叫 /bazi
   → Skill 以九步互動式對話收集：
     姓名、曾用名、陽曆/農曆生日、時辰、性別、出生地、存活狀態
   → Skill 排出四柱、推算大運、生成人格映射摘要

2. 對照本文件 §2 映射規則：
   - 格局 → style tag 修正值
   - 身強弱 → backbone 偏移
   - 人格映射摘要 → baziMd 注入文字
   - 大運表 → baziModifier 週期值

3. 整理並寫入 politicians/<slug>/bazi.md（§1.1 格式）

4. 設定 `資料可信度` 欄位：
   - confirmed：生辰來源有明確文獻或本人聲明
   - estimated：由其他資料推算（如維基百科不確定記載）
   - unknown：無從得知 → 不建立 bazi.md
```

### 7.4 模擬人物的特殊處理

模擬人物（非真實政治人物）無隱私顧慮，可：
- 由設計者指定生辰（世界觀設定）
- 或以亂數生成生辰後調用 `/bazi` 推導人格起點

模擬人物的 `資料可信度` 一律設為 `confirmed`（設定即事實），大運修正器完全啟用。

---

## 8. 待決事項

- [ ] 生辰資料從哪裡蒐集？由 Politician-skill 六軌研究的第七軌補入，還是獨立 pipeline？
- [ ] 若政治人物本人否認或不公開生辰，bazi.md 是否留空還是直接不建立？
- [ ] 大運修正器是否要開放給「外部事件注入」覆寫（[external-event-model.md](external-event-model.md) 的 `OVERRIDE_STATE`）？
