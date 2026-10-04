# CCO 玩家資料交換契約

此目錄定義與 CCO Toolkit 內部 `localStorage`、React UI、Game Data snapshot 解耦的玩家資料交換格式。契約本身保持來源中立；Toolkit 的匯出與匯入服務只是此格式的 adapter，不把網站儲存結構納入交換規格。

## 格式

- 編碼：UTF-8 JSON。
- 建議檔名：`cco-player-data-YYYY-MM-DD.json`。
- MIME：`application/json`。
- 固定 envelope：`format`、`formatVersion`、`exportedAt`、`producer`、`sections`。
- `formatVersion` 只描述 envelope；每個 section 以自己的 `schemaVersion` 演進。
- 顯示名稱與翻譯不作為資料識別；所有資料使用穩定 ID。

目前 section：

| section | v1 內容 |
| --- | --- |
| `progression` | 玩家主等級及五種技能等級 |
| `player-attributes` | 戰鬥與裝備計算所需摘要 |
| `inventory` | 具完整性語意的物品持有數量 |
| `loot-box-history` | 已確認的開箱明細與彙總 |

### v1 穩定 ID 與範圍

`progression` 使用 `level`、`printing-rank`、`medical-science`、`ammo-crafting`、`scavenge-skill`、`mining-skill`。數值皆為 1–800 整數；同一 section 同時包含主等級時，其他技能不得高於 `level`。

`player-attributes`：

| ID | 範圍 |
| --- | --- |
| `max-health` | 0 以上安全整數 |
| `armor` | 0 以上安全整數 |
| `destructive-weapon-damage` | 1 以上安全整數 |
| `critical-damage-percent` | 20–220 整數 |
| `bargain-percent` | 0–40 整數 |
| `damage-reduction-percent` | 0–100 整數 |

`inventory` v1 支援六種背包 ID 與八種背包升級物資 ID，完整清單以 JSON Schema 的 `inventoryItem` enum 及 runtime `playerDataInventoryItemIds` 為準。`quantity` 只能是 0 以上安全整數；同一 `itemId` 不可重複。

`completeness` 的語意：

- `complete`：來源宣告這是受支援目錄的完整快照；未列出項目可在使用者確認後視為 0。
- `partial`：來源只知道列出項目；未列出項目不得清除。
- `manual`：使用者手動維護的數量；匯入時只更新列出項目。

`loot-box-history.records` 保存可編輯的已確認明細，包含可攜式 ID、ISO 8601 時間、箱型、實際開箱數及聚合掉落；單筆開箱數不得超過該箱型 `batchSize`。`rollups` 保存具唯一批次 ID 的舊紀錄彙總，包含箱型、紀錄數、總開箱數與掉落總量。明細與彙總不可共用 ID。

## 版本與擴充

- envelope 不支援時拒絕整份檔案。
- 未知 section 或已知 section 的未知版本可通過 envelope 結構檢查，但必須在預覽中明確列為不支援並略過。
- 已知 section 的已知版本若內容不合法，整份檔案驗證失敗。
- 新物品、等級或玩家屬性先加入對應 catalog；改變既有欄位語意或結構才升級該 section。
- 新資料領域必須建立具名且版本化的 section；不提供任意 `extensions`，也不輸出任何內部 store envelope。

### Section 升級流程

1. 先確認新增資料是否仍符合既有 section 的穩定 ID、型別、單位與範圍；僅擴充 catalog 不升級 section 版本，但必須同步更新 JSON Schema、runtime catalog、adapter、fixtures 與測試。
2. 若改變既有欄位語意或結構，建立新的 `schemaVersion`，保留舊版本的明確驗證／轉換規則；無法安全轉換時，預覽列為不支援，不得猜測或靜默裁切。
3. 若改變 envelope 結構或整份檔案的處理語意，升級 `formatVersion`；舊版對不支援的 envelope 版本拒絕整份檔案。
4. 新資料領域才新增具名 section，更新 section registry 與匯入／匯出 adapter；舊版遇到該 section 時保留摘要並略過，不影響其他已知 section。
5. 每次版本變更都要以最小／完整／未知版本／非法值 fixture、網站 export → import round-trip、容量與回復測試驗證，並同步本文件與隱私說明。

## 明確排除

物價、快取換算、BTC／AI 匯率、BUFF／狀態效果、介面偏好、工具暫存輸入、模擬 seed、計算結果、Game Data snapshot 與不必要的個人識別資訊不屬於此契約。

## 隱私與本機處理

Toolkit 的匯出檔只由目前瀏覽器中的正式資料 API 建立，匯入檔只在目前瀏覽器讀取、驗證、預覽及寫回；流程不連線、不上傳，也不執行檔案內的文字。使用者應自行保管下載檔，因為檔案可能包含其玩家進度、戰鬥屬性、背包數量及已確認開箱紀錄。

## 規範來源

- `player-data-v1.schema.json`：來源中立的 JSON Schema。
- `src/lib/player-data-contract.ts`：網站 runtime validator、section registry、容量限制及跨欄位語意檢查。
- `fixtures/`：跨實作共用的合法與非法樣本。

JSON Schema 負責可攜的結構規範；runtime validator 另檢查技能不可高於主等級、箱型 `batchSize`、箱型與掉落 ID 關係等依賴目前 catalog 的語意限制。兩者變更時必須同步更新 fixtures 與契約測試。

## Toolkit 匯出實作

`src/lib/player-data-export.ts` 只透過 Shared User Inputs、`backpack-planner` 與 `loot-box-analysis` 的具名讀取 API 建立檔案，不列舉或傾印 `localStorage`。匯出前會再次通過 runtime contract，並產生 `application/json`、固定檔名及 UTF-8 位元組大小；超過 5 MB 不建立下載檔。

Shared User Inputs 的 sparse overrides 會解析成目前實際等級與裝備值；economy、effects 及工具衍生結果不進入 envelope。背包只輸出物品數量；開箱輸出已確認 records 與 rollups，並將網站毫秒時間轉為 ISO 8601。

## Toolkit 匯入實作

`src/lib/player-data-import.ts` 提供 parse → validate → preview／plan → commit 流程。預覽與提交共用同一份不可變 plan，提交前會確認受影響 storage raw value 未在預覽後改變；UI 不需也不得自行組合 storage key。

- 等級與玩家屬性預設保留既有衝突值，只有明確選擇覆寫才替換；不自動取最大值或裁切。
- `manual`／`partial` inventory 只更新列出項目；`complete` 只有在選擇整體取代並再次確認後，才將未列出的受支援項目歸零。
- 開箱 records 與 rollups 依跨來源穩定 ID 去重，同一檔案重複匯入不會重複計數。
- 開箱明細超過 2,000 筆時，匯入會將最舊的批次彙總成 rollup，保留總數與掉落統計；不會直接丟棄或讓整批匯入失敗。
- Shared User Inputs、背包與開箱狀態透過具名匯入 adapter 依固定順序寫入；任一步失敗會反向嘗試還原所有受影響 raw value，全部成功後才發布同頁更新事件。其他分頁則由瀏覽器原生 storage event 取得更新。
