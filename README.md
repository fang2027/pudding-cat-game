# 布丁貓的失控舞台 — 素材檢查起始專案

這是 **M0 開發起點**，不是已完成的遊戲。尚未提供或匯入任何真實佳音角色素材。

## 需要的工具

- Node.js（建議近期 LTS）及 npm
- Blender 5.0 或可正常開啟來源 `.blend` 的 Blender 版本

## 第一步：開啟 3D 素材檢視器

```bash
npm install
npm run dev
```

開啟終端機顯示的本機網址。你會看到測試舞台，尚無布丁貓角色。

在 Blender 匯出測試 `.glb` 後，可以直接拖進瀏覽器畫面，或按「選擇 GLB 檔案」。檢視器將列出網格、骨架、Shape Key 與動畫片段的資訊，並提供 Shape Key 滑桿。

**注意：** 這個檢視器只接受單一 `.glb`；不能直接載入 `.blend`。若 GLB 內部沒有包含所需的外部貼圖，可能無法正確顯示材質，須回到 Blender 檢查。

## 第二步：在 Blender 內稽核原始檔（唯讀）

先把 `.blend` 及其貼圖放在你自己的檔案位置。以下為範例，請用真實路徑替換：

```bash
blender --background /path/to/pudding_cat.blend --python scripts/audit_blend.py -- --output /path/to/pudding_cat_audit.json
```

報告會記錄：物件、網格、面數、Armature、骨頭與蒙皮、Shape Key、Driver、Action、材質與圖片，以及外部圖片的存在狀態。

腳本不會修改、儲存、打包或匯出來源 `.blend`。稽核 JSON 需要指定一個有寫入權限的輸出路徑。

目前環境未安裝 Blender，**尚未對真實模型執行這項驗證**。

## 第三步：GLB 匯出（稽核完成後）

只有在確認模型結構後，再使用 Blender 的 `glTF 2.0` 匯出器產出獨立 `.glb`。一般需檢查：

- 是否包含應有的網格與蒙皮骨架。
- 是否勾選匯出 Shape Key／Morph Target。
- 影像貼圖是否正確解析並包含於 GLB。
- 是否有 Driver 或程序式材質需要特別處理。
- 模型位置、朝向、尺度及表情是否正常。

不要直接覆寫原始 `.blend`。若需要腳本自動匯出，必須先依報告檢查特定檔案結構。

## 目前待提供

1. 布丁貓 `.blend`。
2. 該模型使用的外部貼圖（可同資料夾打包 ZIP）。
3. 之後再提供佳音寶寶、佳音女寶寶、法蘭奇及兩支 MP4；不必第一步一次全部上傳。

## 給 Codex 的下一句指令

> 請先閱讀 AGENTS.md、GDD.md、PLAN.md 和 README.md。現在只執行 M0。檢查我提供的布丁貓 .blend 和外部貼圖，執行唯讀素材稽核，整理真實骨架與 Shape Key 名稱，提出不破壞原始檔的 GLB 匯出方案。先不要開發三個 NPC 任務、設計不存在的骨頭名稱或更動原始素材。完成後列出已驗證項目、仍有問題與下一步。

## Codex 雲端與 GitHub

此專案使用 Node.js 24 LTS（見 `.nvmrc`）。在 GitHub 連接此儲存庫後，可在 Codex 雲端選擇它並執行 `npm ci`，再使用 `npm run build` 驗證。瀏覽器預覽可執行 `npm run dev -- --host 0.0.0.0`，並使用環境提供的預覽網址。

角色原始素材和匯出檔應保留在使用者指定的位置；未經明確要求，不上傳至 GitHub 或其他服務。
