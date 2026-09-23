# 種子畫廊 · ImgGenerator

手機優先的 AI 圖片與影片工具。使用自己的 Runware API Key，讓多個模型根據相同描述與參考照片，分別生成作品。

## 使用

1. 開啟 [種子畫廊](https://weiwei84530.github.io/ImgGenerator/)，輸入 Runware API Key。
2. 選擇「製作圖片」或「製作影片」，描述畫面，也可以加入自己的照片。
3. 選擇模型、比例、解析度與數量；影片另可選擇秒數與是否生成聲音，再開始生成。
4. 在「本次作品」放大、播放、下載。圖片可以帶入新的圖片作品，或選擇「用這張圖製作影片」。

Key 驗證成功後會保存到此瀏覽器。設定中可以更換 Key、移除 Key、控制金額顯示、匯出／還原備份與清除資料。

尚未取得 Key 時可以選擇「稍後設定 API Key」，瀏覽、編輯作品及備份；生成前必須到右上角的設定輸入 Key。略過只限這次開啟，重新整理或再次造訪仍會回到設定服務頁。從設定進入 Key 輸入頁時保留導覽列，可點左上角回首頁；新 Key 驗證成功才會替換舊 Key，成功後回到首頁。

導覽列會顯示服務檢查狀態。開啟網站、恢復連線、回到頁面及生成完成時會查詢餘額，也可點選狀態重新檢查。隱藏餘額與費用僅影響顯示，不停止服務檢查或預估計算；查詢權限不足與網路異常顯示「暫時無法確認」，不直接判定 Key 失效。

設定中的「作品儲存」顯示暫存在瀏覽器的參考照片、圖片與影片檔案大小。刪除單份作品會釋出不再被其他作品使用的檔案；「刪除所有作品」保留 Key 與偏好。「備份與還原」可匯出作品或匯入 ZIP，還原時保留原有作品。設定底部的「清除資料並重設服務」則一併移除作品、Key 與偏好。

圖片與影片分別記住上次選取的模型、共用及進階參數，下次建立同類別作品時沿用；不自動帶入描述或照片。這些偏好僅保存在目前瀏覽器，清除全部資料時重設。備份保存各作品設定，不包含裝置偏好。

編輯畫面的「給我一點靈感」會提供四個短標題與完整描述。空白時協助找題材，有文字時延伸目前想法，有照片時會一併看圖；影片提案也會參考秒數與聲音設定。點選後填入描述，可復原原文或繼續修改；「換一批」會送出新的靈感請求，不會自動生成圖片或影片。

靈感使用 [Runware 的 Gemini 3.1 Flash Lite](https://runware.ai/docs/models/google-gemini-3-1-flash-lite)，每次請求依用量計費，實際費用遵守金額顯示偏好。按下按鈕時，目前描述、參考照片及部分已採用描述會由瀏覽器直接送至 Runware 與必要的上游服務。只有正式建立生成任務時的提示詞作為偏好；同次多模型／多張作品只計一次，圖片與影片分開參考，不使用草稿或未採用提案。可展開「靈感怎麼參考我的描述？」查看本機紀錄；紀錄隨作品備份與刪除，不會跨裝置自動同步。推薦品質依模型而異，套用後仍可修改。

## 模型

| 類別 | 模型                                                                | 輸入               |
| ---- | ------------------------------------------------------------------- | ------------------ |
| 圖片 | Nano Banana 2、GPT Image 2.5 Sunburst、FLUX.2 Pro、Seedream 5.0 Pro | 文字、參考照片修改 |
| 影片 | Kling 3.0 Standard、Seedance 2.0 Fast、Veo 3.1 Fast                 | 文字、單張起始照片 |

首次使用時，圖片預選 Nano Banana 2 與 GPT Image 2.5 Sunburst；影片預選 Kling 3.0 Standard，每個模型一支、4 秒、720p，聲音關閉。可以多選模型比較結果，各模型分別計費。文字聊天尚未提供。舊作品保留原本模型名稱；開啟舊圖片草稿時，GPT Image 2 與 Flare 的編輯選項改用 Sunburst。

## 資料與隱私

- 網站為 GitHub Pages 靜態前端，瀏覽器直接呼叫 Runware，沒有網站作者的 API 後端、分析追蹤或遠端作品資料庫。
- 生成時，描述與參考照片會傳送到 Runware 及必要的上游服務。本機保存不表示 API 服務商不處理或保存資料；請參考 [Runware 隱私政策](https://runware.ai/privacy)。
- API Key 保存在本機 `localStorage`，可由同一來源的網頁程式讀取。請只在信任的裝置與瀏覽器使用，並保護 Key。
- 作品與真正的圖片、影片檔案保存在 IndexedDB，匯出 ZIP 不包含 Key。各裝置的歷史不會同步。
- 清除瀏覽器資料、無痕模式關閉、儲存空間被回收，都可能遺失作品。請下載重要作品並定期備份。
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
- 僅對接 Runware REST API。每張圖片、每支影片使用獨立 UUID，先寫入 IndexedDB，再提交一次；後續以 `getResponse` 查詢。
- 斷線或回應不明時，不會自動重新生成。已確認失敗的作品可以由使用者單獨重新提交；查詢原任務不會建立新生成。
- Key 更換後，舊任務需要原 Key 查詢。備份還原中的未完成任務不會自動送出或查詢。
- 圖片參考照片最多 4 張；影片使用單張起始照片。支援 JPG、PNG、WebP，每張 15 MB 內。HEIC 請先轉檔。
- 圖片共用解析度為 1K／2K；直向及橫向比例約為 9:16／16:9。進階設定列出各模型請求的實際尺寸，不裁切生成圖片。每個模型每次可生成 1–4 張。
- 影片提供 4／6／8 秒、720p；僅選 Veo 時可使用 1080p。每個模型每次可生成 1–2 支 MP4。Veo 文字生影片支援直向與橫向，另外兩個模型也支援方形。
- 有起始照片時，影片比例由照片與模型支援能力決定，不強制套用文字生影片的比例；Veo 使用補邊模式。聲音由模型生成，開啟時可能增加費用，實際效果依模型而異。
- 影片保存上限為單檔 100 MB。瀏覽器無法內播時顯示下載提示，可下載後用裝置播放器開啟。
- 模型選單依 Runware 公開價目顯示目前設定的單張／單支預估費用，底部加總所選模型與數量。GPT Image 2.5 Sunburst 依 token 用量計費；無法可靠估算的設定會說明原因，不以範例價格代替。完成後顯示服務商回傳的 USD 實際費用。隱藏餘額與費用時，同時隱藏所有金額與估價說明。餘額讀取受帳戶權限限制，失敗會明示無法讀取。
- ZIP 匯出限制為媒體合計 240 MB；還原上限為壓縮檔 250 MB、解壓資料 500 MB、單一檔案 100 MB。支援舊版圖片備份。備份仍可能受手機記憶體限制，超過上限時請先下載重要作品，再分批整理。
- 本機已保存的作品可在已開啟網頁中離線查看；未提供 Service Worker，因此不保證離線重新載入整個網站。

Runware 參數依 [Nano Banana 2](https://runware.ai/docs/models/google-nano-banana-2)、[GPT Image 2](https://runware.ai/docs/models/openai-gpt-image-2)、[非同步任務](https://runware.ai/docs/platform/task-polling) 與 [帳戶查詢](https://runware.ai/docs/platform/account-management) 官方文件實作。驗證與餘額解析另依真實 REST 回應核對：成功驗證可回傳空的 `data`，餘額支援 USD 數值與包含幣別的物件格式。最近核對日期：2026-09-15。

新增模型依 [FLUX.2 Pro](https://runware.ai/docs/models/bfl-flux-2-pro)、[Seedream 5.0 Pro](https://runware.ai/docs/models/bytedance-seedream-5-0-pro)、[Kling 3.0 Standard](https://runware.ai/docs/models/klingai-video-3-0-standard)、[Seedance 2.0 Fast](https://runware.ai/docs/models/bytedance-seedance-2-0-fast) 與 [Veo 3.1 Fast](https://runware.ai/docs/models/google-veo-3-1-fast) 官方文件實作，並以少量真實生成核對。

GPT Image 2.5 Sunburst 依 [OpenAI 官方模型文件](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst) 與 [Runware 模型文件](https://runware.ai/docs/models/openai-gpt-image-2-5-sunburst) 串接，使用 `openai:gpt-image@2.5-sunburst`、`settings.quality` 與 `settings.background`，已驗證模擬 API 請求及流程，尚未執行 Sunburst 真實付費生成。

## 部署

GitHub Actions 在 `main` 通過型別檢查、單元測試、瀏覽器流程測試與正式建置後，僅上傳 `dist/` 到 GitHub Pages。GitHub Pages 的來源需設定為 **GitHub Actions**。

專案不需要部署用 API Key 或其他秘密。不要把使用者 Key 放在 repo、Actions secrets、URL 或前端環境變數。私人本機規劃與開發資料不屬於部署產物。

## 驗證範圍

自動化流程涵蓋 Key 保存／更換、金額顯示偏好、多模型與照片修改請求、部分失敗、斷線後原任務查詢、下載、新作品帶入照片、備份／還原與刪除。Chromium 與 WebKit 使用手機尺寸模擬，並非真實 iPhone 或 Android。

另涵蓋分類參數記憶、新增模型請求、影片聲音及照片參數、圖片帶入影片、影片下載與備份還原、影片斷線及個別重試。Chromium 驗證實際播放；Windows 的 Playwright WebKit 先遇到 MP4 解碼限制，後續啟動又遭 Windows 安全性封鎖，因此最終 WebKit 流程改由 Linux CI 驗證。測試不要求停用裝置防護。

2026-09-15 已使用真實 Runware API 驗證有效／無效 Key、餘額顯示與重新開啟。透過 Chromium 手機模擬，兩個模型各完成一次文字生圖與一次上傳參考圖修改，並確認下載、帶圖開新作品、瀏覽器關閉後的保存、已載入頁面的離線看圖及 ZIP 匯出。修改範例保留杯子與花朵，將桌面換色；這是少量功能驗證，不代表所有照片的修改品質。WebKit 手機模擬另通過真實 Key 驗證及上述作品備份還原。

真實 iPhone／Android、長時間背景切換、服務商任務保存期限及其他帳戶的餘額權限尚未驗證。模擬 API 測試與桌面瀏覽器模擬不代表這些項目已通過。

同日透過 Chromium 手機模擬完成 FLUX.2 Pro、Seedream 5.0 Pro 各一次文字生圖與參考照片修改，以及三個影片模型各一次 4 秒、720p 無聲文字生影片與有聲照片生影片。已確認六支影片可播放、下載及匯出 ZIP，並抽驗重新開啟、離線播放與實際備份還原後播放；其他秒數、1080p 與所有進階選項未逐一付費實測。
