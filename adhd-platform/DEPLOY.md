# 部署說明（GitHub Pages）

正式網址：`https://jin40225-boop.github.io/ADHD-Website/`

## 部署基準

- Production base：`/ADHD-Website/`（由 `vite.config.ts` 控制）。
- `npm run deploy` 會先執行 production build。
- 每個已知公開／後台／文章路由都會生成獨立的 `dist/<route>/index.html`，直接開啟深層網址會回傳 HTTP 200。
- `dist/404.html` 保留給未知網址，由 React Router 顯示站內 404。
- 各 route HTML 具有對應的 title、description、canonical、Open Graph 與 Twitter metadata。

## 本機驗證

~~~bash
npm ci
npm audit --omit=dev --audit-level=high
npm run typecheck
npm run deploy
npm run check:site
~~~

`check:site` 會檢查部署必要檔、深層路由 HTML、canonical/title，以及內容圖片是否仍使用錯誤的根路徑或缺少 alt。

## GitHub Actions

`.github/workflows/deploy.yml` 在 `main` push 後依序執行：

1. `npm ci`
2. production dependency audit
3. TypeScript typecheck
4. deploy build 與靜態路由生成
5. site check
6. 上傳並發布 GitHub Pages

Repository 的 **Settings → Pages → Build and deployment → Source** 必須設定為 **GitHub Actions**。

## 環境變數

Supabase 連線值只能放在 Actions Secrets 或未納版控的本機 `.env`：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

禁止把 service-role key、OAuth client secret、Gmail token 或個資備份放入 repository。缺少公開 Supabase 設定時，網站會保留離線／本地資料 fallback，不得在前端程式碼硬編秘密。
## Supabase 發布

GitHub Pages workflow 只發布前端，不會套用 PostgreSQL migrations 或部署 Edge Functions。請從乾淨 checkout 執行，並先確認工作目錄沒有被 `.gitignore` 排除的個資 migration／匯入檔。

~~~bash
npx supabase link --project-ref <project-ref>
npx supabase migration list --linked
npx supabase db push
npx supabase functions deploy send-email
npx supabase functions deploy calendar-upsert
npx supabase functions deploy send-instructor-invite
npx supabase functions deploy mcp --no-verify-jwt
~~~

正式 Functions 需要下列 Supabase secrets：

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`

`PUBLIC_SITE_URL` 可選；未設定時，`send-instructor-invite` 會使用正式 GitHub Pages 網址：

- `PUBLIC_SITE_URL=https://jin40225-boop.github.io/ADHD-Website/`

首次 Gmail 同步僅建立最新 25 封郵件的基準，並記錄 Gmail history ID；後續按「同步 Gmail」皆使用 history 增量同步。這可避免大型信箱在 Edge Function 時限內無法完成初始化。

Google refresh token 至少需要：

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/calendar.events`

`gmail.readonly` 是整合收件匣同步郵件、thread 與附件所必需；只有 `gmail.send` 無法讀取 Gmail profile 或郵件。scope 異動後必須以 `access_type=offline`、`prompt=consent` 重新授權並更新 `GOOGLE_REFRESH_TOKEN`，既有 refresh token 不會自動取得新增權限。Google Auth Platform 若仍在「測試」狀態，執行授權的帳號也必須列在測試使用者。

輪替 Google Client Secret 時，先建立新 secret、更新 Supabase secret 並完成寄信與 Calendar smoke test，確認成功後才撤銷舊 secret。不得把 secret 值貼進 issue、commit、Actions log 或本文件。

### 資料清理：直接刪 `registrations` 之前先讀這段

名額計數（`sessions.booked_count`）由兩支東西維護：INSERT 時 `enforce_session_capacity` 遞增，狀態轉成退回／取消時 `admin_transition_registration` 遞減並寫上 `capacity_released_at`。`20260806000032` 補上了 DELETE 的回收 trigger，所以**現在直接刪報名也會把名額還回去**。

仍要知道的一件事：**trigger 看 `capacity_released_at` 決定要不要扣**。一筆已經退回／取消的報名早就把名額還過了，刪除時不會再扣一次——這是刻意的，重複扣會吃掉別的報名的名額，而且沒有任何錯誤訊息（`20260804000015` 修過同一類問題）。所以如果你手動改過 `capacity_released_at`，或用 SQL 直接改過 `status` 而沒有走轉換函式，計數就可能與實際不符。

改狀態一律走後台或 `admin_transition_registration`，不要直接 `update registrations set status = ...`。若懷疑計數已經歪掉，用這個查詢對帳：

```sql
select s.id, s.title, s.booked_count,
       (select count(*) from public.registrations r
         where s.id = any(r.session_ids) and r.capacity_released_at is null) as 實際佔用
  from public.sessions s
 where s.status in ('open', 'full')
 order by s.starts_at;
```

兩欄不一致的那幾列才需要手動修正。

### 排障：`GOOGLE_TOKEN_ERROR: Token has been expired or revoked.`

**症狀**：收信與寄信同時全停。`gmail-sync`、`gmail-labels`、`send-email-v2`、`send-instructor-invite` 四支都靠同一個 `GOOGLE_REFRESH_TOKEN`，所以它一失效就是全倒，不是單一功能壞掉。稽核會留下 `gmail_sync` / `error` 一列。

**修法**：本機跑一次

```
node scripts/get-google-refresh-token.mjs
```

它會問 Client ID 與 Client Secret（secret 輸入時不回顯），開一個 `http://localhost:53682/oauth2callback` 的本機 callback，把授權網址印出來讓你在瀏覽器完成同意，然後**只把 refresh token 印在終端機**——不寫檔、不寫 log。拿到後貼進 Supabase → Project Settings → Edge Functions → Secrets 的 `GOOGLE_REFRESH_TOKEN`，回後台整合設定按一次「同步 Gmail」確認恢復，然後把終端機分頁關掉（那一行是完整憑證）。

執行前先確認 Google Cloud Console 的 OAuth 用戶端已把 `http://localhost:53682/oauth2callback` 列入「已授權的重新導向 URI」，否則會在同意畫面後被擋下。

**⚠ 為什麼會過期——OAuth 同意畫面若停在「測試中（Testing）」，refresh token 固定 7 天後失效。** 這不是可以靠重新授權解決的問題：重新授權只會換來另一個 7 天後同樣失效的 token，於是每週重演一次。要停止重演，到 Google Auth Platform 把發布狀態改成 **「已發布（In production）」**——內部自用的應用不需要通過 Google 審查即可切換。在切換之前，把上面那支腳本當成每週例行工作看待，並且知道它治標不治本。

**兩個常見的空手而回**：

- 拿到回應卻沒有 `refresh_token` 欄位 → 該帳號先前已同意過，而請求少了 `prompt=consent`，Google 便跳過同意畫面且不再發新的 refresh token。腳本已固定帶 `prompt=consent`；若仍如此，到 <https://myaccount.google.com/permissions> 移除本應用的授權後重跑。
- 拿到 token 但實際呼叫才失敗 → 同意畫面少勾了某個 scope。腳本會比對實際取得的 scope 並列出缺少的項目，看到警告就重跑並全部勾選。

## Auth 回跳設定

Supabase Auth 的 Redirect URLs 至少包含：

- `http://localhost:5173/admin/login`
- `https://jin40225-boop.github.io/ADHD-Website/admin/login`

講師邀請會導向 `/instructor/availability?poll=<id>`；未登入者先到 `/admin/login`，登入後回到原邀約。

### 2026-07-22 線上狀態

- `20260722000001_instructor_scheduling.sql` 已套用。
- `send-instructor-invite` 已部署；OPTIONS smoke test 為 200。
- 正式站與本機的 `/admin/login` 已加入 Supabase Auth Redirect URLs。
- 真實寄信、Calendar／Meet 建立及 GCP Client Secret 輪替須以管理者指定測試對象執行，避免自動化流程寄信給現有講師或建立測試行事曆事件。
- `mcp` 為公開唯讀 GPT 工具端點；它只使用 anon key 與公開 RLS 資料，不得改成 service-role key。
- 2026-07-22 已部署並連接 ChatGPT 開發者模式；四個工具已辨識，`list_services` 對話端到端測試通過。

## GPT/MCP 驗證

- MCP endpoint：`https://sssseazkhiswjhtmbluh.supabase.co/functions/v1/mcp`
- Health endpoint：`https://sssseazkhiswjhtmbluh.supabase.co/functions/v1/mcp/health`
- 正式站描述檔：`https://jin40225-boop.github.io/ADHD-Website/gpt-tools.json`

部署後執行 `initialize`、`tools/list` 與四個唯讀工具的 smoke test，再到 ChatGPT 開發者模式新增 MCP app。完整遷移矩陣與安全邊界見 `docs/GPT_SITES_INTEGRATION.md`。

## 正式端到端驗證

1. 匿名讀取 `projects`、`form_schemas`、`sessions_public` 與 `recommendations` 應為 200。
2. 匿名直讀 `sessions` 應為 401 `permission denied`；這是欄位隔離的預期結果，不得為此恢復本表 anon SELECT。
3. 三個 `/register` 路由可載入表單並送出一筆測試報名；測試後由後台刪除或標記。
4. 後台建立講師邀約、寄送邀請，講師登入回覆至少一個可配合時段。
5. 管理者確認成立後，`sessions` 新增一筆場次，並取得 Calendar event 與 Meet URL。
6. 報名審核台寄出一封測試回覆，確認 Gmail thread、`email_messages` 與 `audit_log` 都有紀錄。
7. 公開推薦審核上架後，地圖重新載入即顯示該筆資料。
