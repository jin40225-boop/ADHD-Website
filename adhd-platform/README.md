# adhd-platform

ADHD 專案行政管理系統：公開前台與 /admin 後台共用同一個 React／Supabase 程式庫。
專案治理規範保存在工作區的 ADHD專管系統/AI協作指令/，不隨公開 GitHub 儲存庫發布。

## 開發

~~~bash
npm ci
npm run dev        # http://localhost:5173
npm run typecheck  # TypeScript 零錯誤
npm run build      # tsc -b + vite build
npm run deploy     # 建置 + GitHub Pages 路由產物（見 DEPLOY.md）
~~~

環境變數使用 .env（已由 .gitignore 排除）；鍵名與用途以 .env.example 為準。
任何真實報名、個案、信箱或遷移資料都不得提交到公開儲存庫。

## 主要目錄

| 路徑 | 用途 |
|---|---|
| src/pages/public/、src/content/、src/data/ | 公開頁、文章與可攜式公開資料 |
| src/components/ui/、src/features/ | 品牌元件與可重用功能模組 |
| src/admin/、src/routes/、src/lib/ | 後台整合、路由與 Supabase 存取層 |
| contracts/ | 前後台共用 TypeScript 資料契約 |
| supabase/ | schema、RLS、migrations 與 Edge Functions |
| docs/ | GPT／Sites 整合決策與交付邊界 |
| scripts/ | GitHub Pages 建置與資料產生工具 |

contracts/types.ts 與 src/styles/tokens.css 是跨模組契約，修改時必須同步檢查所有使用端。

## 目前狀態

- ✅ 公開前台：首頁、三類服務、站內報名、推薦地圖與投稿、新手指南、文章、講師、活動回饋。
- ✅ 真實後台：Google 登入、報名審核、場次、報名表、推薦審核上架、信件範本、個案紀錄與活動回饋。
- ✅ Supabase：PostgreSQL、RLS、歷史資料遷移、Gmail 與 Calendar／Meet Edge Functions。
- ✅ 推薦地圖：Supabase 為正式來源，版本化 JSON 為離線與故障後援；審核上架後前台直接讀取。
- ✅ 講師邀約：候選時段、講師名單、登入回覆、代填、成立場次與 Gmail／Calendar 接點皆使用真實資料流。
- ✅ 公開場次：前台只讀安全欄位的 `sessions_public` view；`sessions` 本表拒絕匿名 SELECT 是預期的保護措施。
- ✅ 公開內容：報名、推薦、影片與文章均已脫離舊外部 CMS／表單依賴。
- ✅ 線上後端：講師排程 migration、Gmail／Calendar／講師邀請 Functions、Google OAuth secrets 與 Auth 回呼網址已部署。
- ✅ GPT 整合：公開唯讀 MCP 工具提供服務、場次、推薦與資源查找；報名與個資仍回到正式網站處理。
- ✅ Sites 決策：正式站維持 GitHub Pages／Supabase；不複製既有多路由與權限系統，完整矩陣見 `docs/GPT_SITES_INTEGRATION.md`。
- ⚠️ 帳號維運：正式寄信／建立 Meet 會產生真實外部資料，需由管理者以指定測試對象執行；GCP Client Secret 依帳號安全程序定期輪替。
- ✅ GitHub Actions 自動部署至原 GitHub Pages 網址。

GPT/MCP endpoint、ChatGPT 連接步驟與不可跨越的資料邊界見 `docs/GPT_SITES_INTEGRATION.md`。
Supabase migrations 與 Edge Functions 不會由 GitHub Pages workflow 自動部署；正式發布步驟與外部驗證清單見 `DEPLOY.md`。

## 驗收底線

每次修改至少完成：

1. npm run typecheck
2. npm run build
3. 公開首頁、受影響路由及 /admin/login 的桌面／手機 smoke test
4. 確認 console 無相關錯誤，Git 工作區沒有 .env 或私密遷移資料
