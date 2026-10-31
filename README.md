# 布丁貓的失控舞台 · M3 第一項任務

桌面瀏覽器的 2.5D 跳躍遊戲。使用者已確認 M1、M2 可操作，目前加入佳音寶寶的「舞台道具大救援」。

## 遊玩

1. 靠近佳音寶寶，按 **E** 或互動按鈕，選「接受任務，開始計時」。
2. 往右跨越箱子與缺口，碰到星星取得道具。
3. 帶回佳音寶寶身旁，按 **E → 交還道具**。

方向鍵／A D 移動，空白鍵跳躍，R 返回起點。對話按 Esc 或「繼續探索」關閉。

全場共用 **3 次失誤機會**。掉落、超時、任務中按 R 各扣一次；失敗後可重新接任務，耗盡則重新開始整場。
自由探索不計時；對話、結果視窗及切換分頁暫停。完成任務後的分數保留於本場，重新整理頁面會清除。

目前試玩值：**60 秒、完成 500 分、每剩餘整秒加 10 分**，集中於 `src/mission.js` 的 `RULES`，尚可依試玩調整。
佳音女寶寶與法蘭奇任務仍待確認，尚無三項加總、骨架動作或影片彩蛋。

## 開發與驗證

使用 Node.js 24 LTS（`.nvmrc`）：

```bash
npm ci
npm run dev
```

開啟終端顯示的網址；首頁為遊戲，`/viewer.html` 為 M0 GLB 素材檢視器。

```bash
node tests/physics.test.js
node tests/mission.test.js
npm run build -- --base=/pudding-cat-game/
```

目前有 5 項物理測試及 4 項任務測試，含往返取道具路線。瀏覽器已驗證接受任務、對話暫停、失誤耗盡及重新開始。
`src/physics.js` 調整場地及移動，`src/npcs.js` 管理 NPC 與對話，`src/mission.js` 管理任務規則。

## 素材與後續範圍

`public/assets/characters/` 包含布丁貓、佳音寶寶、佳音女寶寶 GLB；現有缺少貼圖的呈現已獲接受。法蘭奇使用文字牌預留，模型待提供。兩支 MP4 與觸發條件仍待提供／確認。
模型以整體位移呈現，不假設具備角色動畫；各骨架不同，Shape Key 相容性需以檢視器實測。

新 `.blend` 素材須先按 `AGENTS.md` 唯讀稽核，再匯出獨立 GLB，保留原始檔。稽核範例（需要 Blender）：

```bash
blender --background /path/to/source.blend --python scripts/audit_blend.py -- --output /path/to/audit.json
```

匯出時選必要角色網格及骨架，保留蒙皮與 Morph Targets，排除廣告動畫；檢查貼圖與 Driver 相容性。GLB 可拖入 `/viewer.html` 檢查網格、骨架、Shape Keys 和動畫資料。
詳細規劃見 `GDD.md`、`PLAN.md`。本次只完成 M3 第一項，其他任務與彩蛋不自行定案。

## GitHub Pages

網址：https://fang2027.github.io/pudding-cat-game/

建置使用上面的 Pages base 路徑，將 `dist/` 內容及 `.nojekyll` 發佈到 `gh-pages` 分支。GitHub Settings → Pages → Deploy from a branch → `gh-pages`、`/ (root)`。
只同步 `main` 不會更新網站，還需更新 `gh-pages`。發布後等待 GitHub 部署，再重新整理確認頁首 **M3**。
