# ADHD 家長支持平台：正式基準、目前狀態與重啟指南

基準更新日期：2026-08-04（Asia/Taipei）
狀態：正式上線，後續維運
本文件定位：專案技術狀態的單一事實來源。每次正式發布、資料庫結構變更或外部整合狀態改變後，更新本文件並在最下方新增一筆紀錄。

## 1. 正式基準

| 項目 | 基準值 |
|---|---|
| GitHub repository | `jin40225-boop/ADHD-Website` |
| 正式 branch | `main` |
| 正式程式 commit | `c2d6293c27900c22ba1f274a63a336583cfded49` |
| Commit 主旨 | `ci: run check:operations in deploy workflow` |
| 正式網站 | <https://jin40225-boop.github.io/ADHD-Website/> |
| GitHub Pages workflow | <https://github.com/jin40225-boop/ADHD-Website/actions/runs/30882280259> |
| Workflow 結果 | `completed / success` |
| Workflow 完成時間 | `2026-08-04T05:57:14Z` |
| 正式前端資源識別 | `assets/index-B_a12VJU.js` |
| Supabase project ref | `sssseazkhiswjhtmbluh` |
| Production base | `/ADHD-Website/` |

正式程式 commit 與「文件更新 commit」是兩個不同概念。此頁所稱正式程式基準指目前 GitHub Pages 實際部署的 `c2d6293`；若後續只有文件異動，不得誤記為已部署新版功能。

## 2. 權威 checkout 與副本邊界

正式 checkout 已於 2026-08-04 遷出 OneDrive，唯一位置為：

```text
D:\ADHD-Website-release\       ← Git root
└─ adhd-platform\              ← React／Supabase app
```

遷移原因：OneDrive 同步會在 `node_modules` 造成檔案損壞，導致 `npm run typecheck` 無法通過。遷移後 468 檔案驗證一致、`npm ci` 與 `typecheck` 均通過。OneDrive 專案資料夾內已無程式碼，只放文件。

開始工作前必須驗證：

```powershell
Set-Location "D:\ADHD-Website-release"
git rev-parse --show-toplevel
git remote get-url origin
git status -sb
git log -1 --format="%H %s"
```

預期 remote 為 `https://github.com/jin40225-boop/ADHD-Website.git`。OneDrive 專案資料夾內的 `adhd-platform/`、`_codex_maintenance/` 與 `antigravity-staging/` 是歷史副本，不是正式來源，不可直接覆蓋正式 checkout。

推送注意：`.github/workflows/` 的變更需要 token 具備 `workflow` scope。本 repo 的 git 憑證已設為走 GitHub CLI（`credential.https://github.com.helper = !gh auth git-credential`），若換機器需重新設定，否則 Windows 認證管理員的 token 會因缺 scope 而被拒。

## 3. 系統架構基準

- 前端：React 18、TypeScript、Vite 5、React Router、Tailwind。
- 託管：GitHub Pages，深層路由由部署腳本產生獨立 `index.html`。
- 後端：Supabase PostgreSQL、Auth、RLS、Storage 與 Edge Functions。
- 身分：Google OAuth；後台同時受登入與應用層管理角色攔截。
- 公開 GPT：唯讀 MCP，只能查公開服務、公開場次、公開推薦與公開資源。
- 個資邊界：報名、個案、信件、附件、Meet URL、Calendar ID 與管理資料不得進入公開 MCP 或 Git repository。
- 發布邊界：GitHub Actions 只部署前端；Supabase migration、Function 與 secrets 需另行發布及驗證。
- CI 閘門（2026-08-04 起）：`npm ci` → `npm audit --omit=dev --audit-level=high` → `npm run typecheck` → `npm run check:operations` → `npm run deploy` → `npm run check:site`。`check:operations` 先前僅本機執行，現已納入部署 workflow。

## 4. 已完成並上線的能力

### 公開服務

- 三類服務介紹與站內動態報名。
- 公開場次由 `sessions_public` 提供安全欄位。
- 推薦地圖、搜尋、投稿與後台審核。
- 新手指南、文章、合作講師與活動回饋。
- 公開報名改由 `submit-registration` 處理；名額檢查、狀態與速率限制在後端執行。

### 行政營運中心

- 工作總覽與追蹤任務。
- 整合收件匣、搜尋、未讀／待回覆／等待對方／已處理狀態。
- 信件草稿、版本歷程、範本、附件與往來 thread 資料模型。
- 人員主檔，串聯報名、講師、個案、活動與信件。
- 報名審核的狀態、優先度、負責人、註解、缺漏提示、場次轉移與容量安全處理。
- 個案建立、編輯、轉移、結案與服務紀錄版本。
- 活動中心、場次、名額、講師與 Calendar／Meet 接點。
- 成員邀請、角色與權限管理。
- 整合健康度與稽核紀錄。

### 2026-07-24 後端發布

- Migration：`supabase/migrations/20260723000001_admin_operations_hub.sql`
- 已部署 Function：
  - `submit-registration`
  - `send-email-v2`
  - `gmail-sync`
  - `team-invite`
- Migration 建立或擴充：
  - `contacts`
  - `activities`
  - `follow_up_tasks`
  - 註解與版本歷程
  - email threads、messages、drafts、versions、attachments
  - cases 與 `case_transfers`
  - 容量安全 RPC、報名速率限制、私有附件 bucket
  - 對應 RLS、index、trigger 與 audit

## 5. 2026-07-24 驗證證據

### Git 與部署

- 發布前 `main` 與 `origin/main` 一致，正式程式 HEAD 為 `60230a2`。
- GitHub Actions run `30099005645`：`completed / success`。
- 正式站重新抽查下列路由，均為 HTTP 200 且載入 `Emap0En6`：
  - `/`
  - `/admin`
  - `/admin/login`
  - `/admin/inbox`
  - `/admin/cases`
  - `/admin/registrations`
  - `/admin/people`
  - `/admin/activities`
  - `/admin/integrations`

### 自動化檢查

```text
npm run typecheck          PASS
npm run check:operations  PASS
npm run build              PASS
npm run deploy             PASS
npm run check:site         PASS（37 routes、11 content files）
deno check                 PASS（4 個新 Edge Functions）
git diff --check           PASS
npm audit --omit=dev       0 high vulnerabilities
```

### 資料庫與 Function

- `20260723000001_admin_operations_hub` 已套用並出現在 migration history。
- 12 項資料表、欄位、RPC、RLS 與 storage 結構檢查通過。
- Function 無個資煙霧測試：
  - `submit-registration` 空資料 → 400
  - `send-email-v2` 空資料 → 400
  - `gmail-sync` 未授權 → 401
  - `team-invite` 空資料 → 400

### 正式 UI

- 未登入開啟 `/admin` 會導向 `/admin/login`。
- 既有管理者登入狀態可開啟整合收件匣與個案管理。
- 從收件匣點擊「個案管理」後，URL、作用中選單與頁面內容正確切換。
- 桌面版及 390px 行動版皆無相關 console error。
- 行動版 `scrollWidth` 等於 `clientWidth`，未發現水平溢位。
- 驗證過程未按 Gmail 同步、未寄信、未建立個案，也未改動正式資料。

## 6. 已知缺口與不可誤判事項

| 項目 | 現況 | 完成判準 |
|---|---|---|
| Gmail 自動推播 | 尚未實作 `users.watch` 自動續訂 | 建立 watch／Pub/Sub、續訂排程、失敗告警與重放驗證 |
| 真實寄信 | 僅完成安全驗證，未自動寄給真實對象 | 指定測試收件者，確認 Gmail thread、DB message 與 audit 一致 |
| Calendar／Meet | 程式與接點存在，尚未做本輪真實 E2E | 指定測試場次，確認事件、Meet URL、DB 回寫與重試 |
| CAPTCHA | 後端可讀 `TURNSTILE_SECRET_KEY`，前端 widget 未啟用 | 前後端 token 流程、錯誤 UX 與無障礙驗證完成 |
| 速率限制 | 已啟用 | 持續監測誤擋、繞過與管理者查核方式 |
| `gmail-sync` HTML 轉純文字修正 | `8a9bb42` 已改 `supabase/functions/gmail-sync/index.ts`，但 Pages workflow 不部署 Edge Function，正式環境仍是舊版 | 執行 `npx supabase functions deploy gmail-sync` 後，以測試信驗證收件匣不再顯示 CSS 片段 |
| react-router 漏洞 | `npm audit` 有 2 個 moderate（未達 CI 的 high 門檻） | 評估升級 react-router / react-router-dom 後重跑完整驗收 |

「檔案存在」、「Function 已部署」或「測試回傳 400／401」不等於外部服務端到端完成；上述缺口必須用指定測試帳號與測試資料驗收後才能關閉。

## 7. 重啟工作程序

### A. 先恢復事實

```powershell
Set-Location "D:\ADHD-Website-release"
git status -sb
git remote -v
git fetch origin
git log --oneline --decorate -5
git diff --stat
```

若存在非本次工作建立的修改，先保留並辨識所有權，不可使用 `git reset --hard`、`git clean` 或覆寫檔案。

### B. 恢復開發環境

```powershell
Set-Location ".\adhd-platform"
npm ci
npm run typecheck
npm run check:operations
npm run deploy
npm run check:site
```

本機 `.env` 已被 Git 排除。只可核對 `.env.example` 的鍵名，不得把 `.env`、OAuth secret、refresh token、service-role key、個資或信件內容貼入紀錄、issue、commit 或 AI 對話。

### C. 判定 Supabase 差異

```powershell
npx -y supabase link --project-ref sssseazkhiswjhtmbluh
npx -y supabase migration list --linked
```

在執行 `db push` 或部署 Function 前，先比對本地 migration、linked history 與正式 Function 清單。GitHub Pages workflow 不會代為發布 Supabase。

### D. 修改後最低驗收

1. `npm run typecheck`
2. `npm run check:operations`
3. `npm run deploy`
4. `npm run check:site`
5. 受影響路由的桌面與 390px 行動版 smoke test
6. 登入／角色邊界與 console error 檢查
7. 若碰觸 SQL、RLS、寄信或 Calendar：另做資料庫與外部整合驗證
8. 更新本文件的基準、缺口與更新紀錄

## 8. 下一步優先序

自 2026-08-04 起，開發依據為 OneDrive 專案資料夾內的
`00_進行中專案/ADHD專管系統/重構建構計畫_2026-08-04.md`（全面重構定稿，Phase 0–6 順序已定，15 條裁決不得重談）。
UI 唯一基準為 `重構審閱稿_2026-08-04/` 內的 `01_v3`、`02_v2`、`03_v4`、`04_v4`。

- Phase 0 版本恢復：**已完成（2026-08-04）**，見第 12 節。
- Phase 1 資料庫 → Phase 2 前台 → Phase 3 後台 → Phase 4 信件系統 → Phase 5 內容收尾 → Phase 6 AI 文件生成（最後，屆時才提供 Claude API 金鑰）。

下列既有缺口併入重構計畫處理，不另立優先序：測試往返信（Phase 4）、Calendar／Meet E2E（Phase 3）、Gmail `users.watch`、前端 Turnstile widget。

## 9. 更新紀錄

| 日期 | 程式基準 | 狀態 | 證據 |
|---|---|---|---|
| 2026-08-04 | `c2d6293` | 全面重構 Phase 0：`8a9bb42` 合併進 `main` 並部署；`check:operations` 納入 CI；正式站行動版 390px 驗證無水平溢位 | Actions `30882280259` success、CI log 出現 `Admin operations structural checks passed.`、資源切換為 `index-B_a12VJU.js`、9 個前台路由 390px 量測 `scrollWidth == clientWidth` 且無 console error |
| 2026-08-02 | `766b71a` | Gmail 安全同步修復、migration 對帳、介面狀態文字校正與正式基準部署；正式站已切換新版資源 | Actions `30753845211`、首頁／後台／收件匣 HTTP 200、資源 `index-BGzeX90A.js` |
| 2026-07-24 | `60230a2` | 整合行政營運中心正式上線；資料庫 migration 與 4 個新 Functions 已發布 | Actions `30099005645`、正式路由抽查、登入後台桌面／行動版驗證 |

## 10. 2026-07-29 Gmail 授權與同步修復

- Google Cloud 專案 `idyllic-vehicle-502602-h0` 已啟用 Gmail API。
- OAuth refresh token 已重新取得並驗證包含 `gmail.readonly`、`gmail.send`、`calendar.events`；Supabase 專案 `sssseazkhiswjhtmbluh` 的三項 Google secrets 已完成輪替，憑證值未寫入版本庫。
- `gmail-sync` Edge Function 已部署：缺少 scope 時會回傳可操作的中文訊息，資料庫錯誤會保留 message/details/hint/code，不記錄郵件內容或憑證。
- Production 的 `email_messages_gmail_uidx` 已由部分唯一索引改為完整唯一索引；對應 migration：`supabase/migrations/20260729000001_fix_email_messages_gmail_unique.sql`。
- 首次同步改為最新 25 封建立基準並跳過已匯入 Gmail ID，避免大型信箱超過 Edge Function 時限；後續使用 Gmail history 增量同步。
- E2E 證據：首次同步 `success / full:0`，增量同步 `success / incremental:0`；落庫 104 封郵件、99 個對話、1 筆 sync state，history ID 已建立。
- 遠端 migration history 的既有落差已於 2026-08-02 完成唯讀 schema 驗證與 metadata repair；詳見下一節。後續執行 `db push` 前仍須先跑 `migration list --linked`，不可只依文件假設一致。
- 尚未建置 Gmail `users.watch` / Pub/Sub 推播；目前由管理員按鈕觸發增量同步。

## 11. 2026-08-02 migration history 對帳

- `20260713000001` 是 production-only 的歷史 Notion 報名匯入，原始 SQL 含個資並持續由 `.gitignore__ 精確排除；Git 僅保留不含資料、不同檔名的 `20260713000001_k4_notion_registrations_redacted.sql` 版本佔位檔。
- 修復前逐項確認正式 schema：5 筆互助聚會場次、`event_feedback` 的 RLS／索引／policies、`sessions_public` 的 grant 與 anon 隔離、`confirm_availability_poll` 的 security invoker／權限，以及 `email_messages_gmail_uidx` 的完整唯一索引均符合本地 migration。
- 經使用者明確授權後，只對 `20260717000001`、`20260718000001`、`20260719000001`、`20260722000001`、`20260729000001` 執行 `migration repair --status applied`；沒有重跑 SQL、沒有變更 schema 或正式服務資料。
- 修復後 `supabase migration list --linked` 顯示 12 個 local／remote 版本全部對齊。

## 12. 2026-08-04 全面重構 Phase 0 驗收

- 開發 checkout 遷出 OneDrive 至 `D:\ADHD-Website-release`（468 檔案一致、`.env` 隨行、`git fsck` 正常）；新位置 `npm ci` 與 `npm run typecheck` 通過，證實先前 typecheck 失敗來自 OneDrive 同步損壞而非程式問題。
- `chore/reconcile-production-baseline-20260802` @ `8a9bb42` 以 fast-forward 合併進 `main`（無 merge commit），內容為行動版水平溢位修正（`PublicLayout` 加 `overflow-x-hidden`）、後台信件 HTML 轉純文字顯示修正、後台頁面 metadata、`gmail-sync` HTML 轉文字、首頁與同儕聚會頁日期星期錯字。
- `check:operations` 加入 `.github/workflows/deploy.yml`（commit `c2d6293`），位置在 `typecheck` 之後、`deploy` 之前。CI log 已確認輸出 `Admin operations structural checks passed.`。
- 部署：Actions run `30882280259` `completed / success`，`pages_build_version = c2d6293`，正式站資源由 `index-BGzeX90A.js` 切換為 `index-B_a12VJU.js`。
- 390px 行動版實測（正式站，量測 `document.documentElement`）：`/`、`/parent`、`/parent/register`、`/peer-group`、`/peer-group/register`、`/navigator`、`/navigator/register`、`/guide`、`/articles` 共 9 個路由，`scrollWidth` 均等於 `clientWidth`（390），溢位為 0，無 console error。首頁的裝飾性絕對定位元素仍超出視窗邊界，但已被 `overflow-x-hidden` 裁切，不產生水平捲動。
- 本階段未觸碰 Supabase：未執行 `db push`、未部署 Edge Function、未變更 secrets 或正式資料。
