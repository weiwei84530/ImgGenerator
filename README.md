# 拾光畫室 · ImgGenerator

手機優先的 AI 圖片工具。使用自己的 Runware API Key，讓 Nano Banana 2 與 GPT Image 2 根據相同描述與參考照片，分別生成圖片。

## 使用

1. 開啟 [拾光畫室](https://weiwei84530.github.io/ImgGenerator/)，輸入 Runware API Key。
2. 選擇「製作圖片」，描述畫面，也可以加入自己的照片。
3. 選擇模型、比例、解析度，以及每個模型的張數，再開始生成。
4. 在「本次作品」放大、下載，或選擇「用這張圖開始新作品」。

Key 驗證成功後會保存到此瀏覽器。設定中可以更換 Key、移除 Key、控制金額顯示、匯出／還原備份與清除資料。

第一版提供圖片生成與照片修改。影片與文字聊天尚未提供。

## 資料與隱私

- 網站為 GitHub Pages 靜態前端，瀏覽器直接呼叫 Runware，沒有網站作者的 API 後端、分析追蹤或遠端作品資料庫。
- 生成時，描述與參考照片會傳送到 Runware 及必要的上游服務。本機保存不表示 API 服務商不處理或保存資料；請參考 [Runware 隱私政策](https://runware.ai/privacy)。
- API Key 保存在本機 `localStorage`，可由同一來源的網頁程式讀取。請只在信任的裝置與瀏覽器使用，並保護 Key。
- 作品與真正的圖片檔案保存在 IndexedDB，匯出 ZIP 不包含 Key。各裝置的歷史不會同步。
- 清除瀏覽器資料、無痕模式關閉、儲存空間被回收，都可能遺失作品。請下載重要圖片並定期備份。
- 不向網站作者傳送生成資料；GitHub 仍會處理提供網站所需的一般連線資料。

## 本機開發

需要 Node.js 24 與 npm。

```sh
npm ci
npm run dev
```

Windows PowerShell 若限制執行 `.ps1`，可以使用 `npm.cmd` 與 `npx.cmd`。

```sh
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

測試中的 Runware 回應由 Playwright 攔截；測試 Key 是假的，不會呼叫付費生成。正式程式沒有測試登入或假生成模式。

## 架構與限制

- React + TypeScript + Vite，手機單欄布局；桌面採置中且限制寬度的相同布局。
- 僅對接 Runware REST API。每張圖片使用獨立 UUID，先寫入 IndexedDB，再提交一次；後續以 `getResponse` 查詢。
- 斷線或回應不明時，不會自動重新生成。已確認失敗的圖片可以由使用者單獨重新提交；查詢原任務不會建立新生成。
- Key 更換後，舊任務需要原 Key 查詢。備份還原中的未完成任務不會自動送出或查詢。
- 參考圖片最多 4 張，支援 JPG、PNG、WebP，每張 15 MB 內。HEIC 請先轉檔。
- 共用解析度為 1K／2K；直向及橫向比例約為 9:16／16:9。進階設定列出各模型請求的實際尺寸，不裁切生成圖片。
- 費用由服務商依實際用量計算，未提供可靠的送出前數值估價；完成後顯示服務商回傳的 USD 費用。餘額讀取受帳戶權限限制，失敗會明示無法讀取。
- ZIP 匯出限制為圖片合計 240 MB；還原上限為壓縮檔 250 MB、解壓資料 500 MB。大圖備份仍可能受手機記憶體限制，超過上限時請先下載重要圖片，再分批整理作品。
- 本機已保存的圖片可在已開啟網頁中離線查看；未提供 Service Worker，因此不保證離線重新載入整個網站。

Runware 參數依 [Nano Banana 2](https://runware.ai/docs/models/google-nano-banana-2)、[GPT Image 2](https://runware.ai/docs/models/openai-gpt-image-2)、[非同步任務](https://runware.ai/docs/platform/task-polling) 與 [帳戶查詢](https://runware.ai/docs/platform/account-management) 官方文件實作。文件核對日期：2026-09-12。

## 部署

GitHub Actions 在 `main` 通過型別檢查、單元測試、瀏覽器流程測試與正式建置後，僅上傳 `dist/` 到 GitHub Pages。GitHub Pages 的來源需設定為 **GitHub Actions**。

專案不需要部署用 API Key 或其他秘密。不要把使用者 Key 放在 repo、Actions secrets、URL 或前端環境變數。私人本機規劃與開發資料不屬於部署產物。

## 驗證範圍

自動化流程涵蓋 Key 保存／更換、金額顯示偏好、多模型與照片修改請求、部分失敗、斷線後原任務查詢、下載、新作品帶入照片、備份／還原與刪除。Chromium 與 WebKit 使用手機尺寸模擬，並非真實 iPhone 或 Android。

尚須用實際 Runware Key 與明確測試預算完成：真實生成品質、照片修改效果、實際帳戶餘額權限、長時間背景切換與服務商任務保存期限。模擬 API 測試不代表這些項目已通過。已以刻意無效的 Key 實測瀏覽器可直連並讀取 Runware 的驗證錯誤回應，未進行付費生成。
