# PoC 對標資料

對應 [docs/04-poc-plan.md §2 §6](../docs/04-poc-plan.md)。

## 檔案

- `ground-truth.schema.json` — 對標資料集 schema（JSON Schema 2020-12）
- `ground-truth.json` — 實際資料（待人工蒐集後填入）

## 目前選定案例

**草案**：`tw-2017-labor-act-amendment`（一例一休修正案）

5 位政治人物（**待用戶確認**）：
- 蘇貞昌（民進黨）
- 林淑芬（民進黨內反對派）
- 林為洲（國民黨）
- 賴香伶（時代力量 / 民眾黨）
- 徐永明（時代力量）

組合用意：刻意挑「同黨內也有歧異」，避免 5 個 agent 投出純黨紀分佈，符合 PoC §2 準則 #3「立場有張力」。

## 蒐集準則

對齊 [04-poc-plan.md §2](../docs/04-poc-plan.md)：

1. 每位政治人物至少 2 筆公開來源（`politicians[*].sources`）
2. `actualVotes` 必須有 `sourceUrl`（公報或表決紀錄）
3. `bill.articles` 抽出 3-5 條核心條文即可，不需全文
4. `stanceVector` 三維值由人工從來源文本標注，不靠 LLM 生成（避免測試時自我驗證）

## 驗證

填寫完畢後，用任一 JSON Schema validator 檢查：

```bash
npx ajv-cli validate -s ground-truth.schema.json -d ground-truth.json
```
