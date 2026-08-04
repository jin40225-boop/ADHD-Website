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
| `gmail-sync` HTML 轉純文字修正 | 2026-08-04 已部署（version 5 → **6**，ACTIVE）；同步筆數已由稽核頁取得：8/4 增量 11 封＋12 封、8/2 全量 63 封 | 下次有新進信件時，確認收件匣內文為純文字（無 CSS 片段） |
| ~~親職報名「孩子可增減多筆」~~ | ✅ 2026-08-04 已實作：表單引擎新增 `group` 型別（見第 15 節） | — |
| ~~報名確認頁顯示場次 UUID~~ | ✅ 2026-08-04 已修：確認頁的 `flatten()` 會把有 options 的欄位值對映回標籤 | — |
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
| 2026-08-04 | `c2d6293` | Phase 1 主體：同儕下半年 5 場、導航 9–12 月（每月 1 位）、聯絡人類群、出席確認、文件紀錄、信件狀態機、8 範本種子（migration `…0002`／`…0003`） | `migration list --linked` 15 版全對齊；三個報名頁 390px 實測；`sessions` 30 筆、`contact_groups` 5、`email_templates` 10 |
| 2026-08-04 | `c2d6293` | Phase 1 插隊項：親職下半年 15 場次建立＋報名表單新增 10 欄位（migration `20260804000001`）；`gmail-sync` 補部署 v6 | `migration list --linked` 13 版全對齊；`/parent/register` 完整報名實測成功、額滿前後端雙重驗證 |
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
- Phase 0 主體未觸碰 Supabase：未執行 `db push`、未變更 secrets 或正式資料。

### Phase 0 收尾：gmail-sync Edge Function 部署（2026-08-04）

- 背景：`8a9bb42` 修改了 `supabase/functions/gmail-sync/index.ts`（收信 HTML 轉純文字），但 GitHub Pages workflow 只部署前端，造成正式後端與 `main` 程式基準版本漂移。經使用者核准後補部署。
- 執行：`npx supabase functions deploy gmail-sync --project-ref sssseazkhiswjhtmbluh`
- 結果：`Deployed Functions.`；`functions list` 確認 `gmail-sync` `status=ACTIVE`、`version` 由 **5 → 6**、`updated_at = 2026-08-04 14:21:47`（本地時間）。
- 煙霧測試：未帶 JWT 對 `https://sssseazkhiswjhtmbluh.supabase.co/functions/v1/gmail-sync` POST → **401 Unauthorized**（`verify_jwt=true`，符合預期，未讀取任何信件）。
- **未完成**：管理員手動增量同步的端到端驗證需登入後台操作，尚未執行；見第 6 節缺口表。
- `migration list --linked`（同日）：12 個版本 local／remote 全部成對，**無任何漂移**。
- ⚠️ 發現：此 Supabase 專案同時託管另一專案「白露 LINE 工作助手」的 Function（`line-webhook` v49、`reminder-cron` v17，entrypoint 指向 `line-assistant` repo）。ADHD 平台與該專案共用同一個 Supabase project／資料庫。後續 `db push` 前必須先確認表名無衝突、且不影響該專案。

## 13. 2026-08-04 全面重構 Phase 1（插隊項：親職下半年場次與表單欄位）

### 為何插隊

親職 8/16 場次的報名截止為 8/9，早於 Phase 2 新版報名頁的完成時程。現行 `/parent/register` 是 schema-driven，且 `RegisterPage.tsx` 會用 DB 場次取代表單裡的靜態 `preferredSlots` 選項，因此只要建好 `sessions`，現行頁面即可立即收件。經使用者核准後將此項提前執行。

### 施工前唯讀盤點（共用專案風險）

- `inspect db table-stats --linked` 結果：白露 LINE 助手的 11 張表全部位於 **`personal_assistant` schema**，與 ADHD 的 `public` schema 無命名衝突。
- 計畫新表 `contact_groups`、`contact_group_members`、`attendance_confirmations`、`generated_documents` 遠端皆不存在，可安全建立。
- `email_templates` **已存在**（2 筆），Phase 1 後續應以 INSERT 種子處理，不可 `create table`。
- `public` 內有 4 張非 ADHD migration 建立的空表：`news`、`site_content`、`members`、`contact_messages`（皆 0 筆，來源不明）。**不得刪除或修改**，列入 Phase 5 收尾清點再查來源。

### 變更內容（migration `20260804000001_parent_h2_sessions_and_fields.sql`）

- 新增 15 筆 `public.sessions`：親職 5 日（8/16、9/6、10/11、11/8、12/20）× 3 時段（09–10／10–11／11–12），`capacity=1`、`status='open'`。施工前 `sessions` 表內親職場次為 0 筆。
- 更新 1 筆 `public.form_schemas`（parent）：新增 10 個欄位（`preferredName`、`relationshipOther`、`familyType`、`attendMode`、`attendWith`、`contactTimes`、`contactTimeNote`、`contactMethod`、`childMedication`、`childOtherConditions`、`consultTopics`）。
- **相容性策略：純新增**。既有 key（`parentName`、`childName`、`childGender` 等）一律不改名、不刪除，因為 `registrations` 已有 97 筆歷史資料使用舊 key，改名會使後台詳情讀不到值。欄位整併留待 Phase 2。

### 驗收證據

- `migration list --linked`：13 個版本 local／remote 全部成對，單邊項目 0。
- `sessions_public` 查詢：15 筆親職場次全部建立，時間與裁決 2 一致（Asia/Taipei）。
- `/parent/register` 390px 實測：`scrollWidth == clientWidth == 390`，10 個新欄位全部正確渲染，15 個場次選項全部列出。
- 完整報名流程實測（虛構測試資料，時段選 12/20 11:00–12:00 以避開 8/16 急件）：填寫 → 確認頁 → 送出 → 「報名已送出！」；DB 該場次 `booked_count` 由 0 → 1、`status` 自動由 `open` → `full`。
- 額滿邏輯雙重驗證：
  - 前端：重載表單後該時段顯示「（剩 0 名）（額滿）」且 `disabled=true`，其餘 14 場維持可選。
  - 後端：直接對 `submit-registration` 以該場次送出第 2 筆 → **HTTP 409 `SESSION_FULL_OR_CLOSED`**，且 `booked_count` 維持 1，未產生多餘預約。
- 測試殘留已清除（2026-08-04）：使用者於後台將 `phase1-test@example.com` 退回，狀態變為 `rejected`；後台場次清單顯示 12/20 11:00 為 `0/1`，公開報名頁該時段回復「剩 1 名」可選。**「退回 → `booked_count` 釋出 → 場次由 `full` 重開為 `open` → 前台即時反映」整條自動連動實測正常。**

## 15. 2026-08-04 全面重構 Phase 2（進行中）

### 已完成：表單引擎升級 ＋ 親職報名頁（六節第 1 項）

架構決定：**不為親職頁寫一次性元件，而是升級 schema 驅動的表單引擎**——因為 Phase 3 後台要能編輯表單，`form_schemas` 必須維持唯一事實來源。

引擎新增能力（`contracts/types.ts`、`features/form-engine/`）：

| 能力 | 說明 |
|---|---|
| `stage` ＋ `FormSchema.stages` | 多階段表單。步驟指示器、逐階段驗證、確認頁按階段分組並提供「修改」跳回 |
| `group` ＋ `subFields` | 可增減的重複群組（孩子多筆）。答案為物件陣列，錯誤鍵為 `群組key.索引.內層key` |
| `visibleWhen` | 條件顯示。不成立時不顯示、不驗證，送出前由 `pruneHiddenAnswers()` 移除 |
| `radio` | chip 樣式單選 |

型別擴充：`Registration.answers` 與後台 `updateRegistrationAdministration` 的 answers 型別加入 `Record<string, string｜string[]>[]`；`form_schemas` 新增 `stages jsonb` 欄位（migration `20260804000005`）。

親職表單改為 01_v3 定稿結構：階段一（服務說明・選時段）＋階段二（家長與孩子狀況）＋引擎提供的確認頁。⚠ 平面孩子欄位（`childName`／`childGender`…）由 `children` 群組取代；既有 97 筆報名的舊 key 仍會在後台「其他欄位」區塊顯示，資料未遺失。

順帶修掉確認頁顯示 session UUID 的問題：`flatten()` 會把有 `options` 的欄位值對映回標籤。

### 驗收證據

- 本機 dev server 390px 實測：階段一（15 個場次、未選時段擋下並顯示「請填寫「選擇場次」」）→ 階段二（條件欄位三項皆正確依答案出現：身份選「其他」→ 說明欄、出席方式選「與他人一同出席」→ 同行對象、聯繫時間勾「其他（自填）」→ 自填欄）→ 孩子多筆（新增至 2 位、超過最小筆數後出現「✕ 移除」）→ 確認頁（分階段顯示、逐階段「修改」、兩位孩子完整展開、場次顯示可讀標籤而非 UUID）。全程 `scrollWidth == clientWidth == 390`，無 console error。
- 正式站部署後複驗：資源 `index-ahGg-BG4.js`，步驟指示器與 15 個場次正常，390px 溢位 0。

### 已完成：互助聚會服務頁 `/peer-group`（六節第 2 項）

手寫的「已經完成辦理活動區」共 437 行、17 張靜態場次卡（含 4 個寫死的 `meet.google.com` 連結）整段移除，改掛 `<SessionHistory />`：讀 `sessions_public` 且只取 `status='done'`，依民國年摺疊。歷史 Meet 連結因此是**結構性下架**（view 不含 `meet_url`），不是靠人記得刪。

⚠ 範圍變化：舊手寫區把家長諮詢、導航計畫的場次也列在互助聚會頁上；`SessionHistory` 預設 `projectSlug='peer-group'`，因此本頁只剩互助聚會自己的軌跡。其餘兩案的軌跡歸各自服務頁（六節第 3 項）。

聯繫區改為 02_v2 定稿：內嵌 LINE QR（`components/LineQrCode.tsx`）＋加友按鈕＋信箱一鍵複製。QR **不外連圖床**，路徑資料取自定稿並經解碼驗證（見驗收證據）。

順帶修掉一個既有壞按鈕：頁尾「複製」鈕是從舊站搬來的靜態 HTML（`id="copyButton"`／`id="copyMessage"`，全 repo 無任何 handler），點了不會有反應。新增 `components/CopyButton.tsx` 取代，並在剪貼簿被拒時顯示「請手動複製」而非靜默失敗。**同一顆死按鈕仍存在於 `HomePage.tsx`、`ParentConsultPage.tsx`、`NavigatorConsultPage.tsx`**，於六節第 3 項一併換掉。

`scripts/check-admin-operations.mjs` 對本頁的斷言同步改寫：原本斷言頁面含字串 `2026年7月11日 (六)`（手寫卡的日期，已隨手術消失），改為斷言含 `<SessionHistory />`、`<LineQrCode />`，且**不得**再出現 `meet.google.com`。

### 驗收證據（互助聚會頁）

- `npm run typecheck`、`npm run build`（✓ built in 4.15s）、`npm run check:operations` 三項皆通過。
- 本機 dev server（:5174）DOM 實測：`meet.google.com` 連結 **0** 個；即將場次卡 5 張（8/9 月可報名、10–12 月「即將開放」不可報名）；活動軌跡 5 筆且全為 `done`；無 console error。
- QR 驗證：以自寫解碼器（掃 SVG path → 29×29 模組矩陣 → 讀格式資訊 EC=M／mask=1 → 反遮罩 → byte 模式）解出內容為 `https://line.me/R/ti/p/@823pawtr`，與頁面加友按鈕同一目標。瀏覽器實際渲染出的 path 與來源 byte 相同（長度 8636、模組 432、hash 2601604142），渲染尺寸 132×132。
- 複製鈕：兩顆（信箱、帳號）點擊後狀態皆變更，證明 handler 已接上。自動化分頁因 `Document is not focused` 走失敗分支顯示「請手動複製」；`isSecureContext=true`、`clipboard-write` 權限為 `granted`，真人點擊會走成功分支。

### 已完成：導航計畫報名頁 `/navigator/register`（六節第 2 項）

導航是「每月 1 位、5 個確切候選時段共用」的模型，所以一筆 session 的 `starts_at`～`ends_at` 是整個月的候選窗口，舊頁面直接印成「2026/09/12 20:00–10:00」。改為把 `sessions.slot_options` 攤成逐一可勾的選項，依月份分組並標示開放狀態與報名截止（04_v4）。分組（`group`／`groupNote`）與選項小字（`note`）是加在 `FormFieldOption` 的選填屬性上，任何 multiselect 都能用——親職與同儕表單維持原本的平鋪外觀。

`UpcomingSessions` 同步處理這個模型：帶 `slotOptions` 的場次改顯示「N 月・共 5 個候選時段」，不再印出跨日的時間窗。

**名額行為變更（經使用者核可）**：原本勾選的每個場次都會在送出當下各扣一份名額，導航每月只有 1 位，因此一位報名者跨月勾選 4 個月就會在審核前把整年擋掉。改為**只有最早的月份佔名額**，其餘勾選以可讀標籤存進 `answers.preferredExactSlots`（例：`9 月｜9/14（一）20:00–21:00`），配合既有的「退回→自動釋額」形成「先到先保留、審核決定去留」。原始的 `<sessionId>::<index>` 值不入 answers——佔名額的場次已記在 `registrations.session_ids`。報名工作台的 `ANSWER_LABEL` 讓這兩個注入鍵顯示可讀標題。

migration `20260804000009`：移除標題補述、刪掉三個已被取代的表單欄位（`preferredExactSlots` 靜態複本、死欄位 `preferredSlots`、還能選到過去月份的 `registerMonth`），並補建 5–8 月 `done` 場次（原本只存在於手寫卡）。

### 已完成：首頁與兩個服務頁、`/guide`、`/articles`（六節第 3、4 項）

- **首頁**：437 行手寫歷史區（含 4 個 Meet 連結）換成 `<SessionHistory>`，一次合併三個服務的軌跡並標示服務標籤。
- **`/parent`**：寫死的「上半年度開放場次（4/18、5/23、6/6）」換成 `UpcomingSessions`；加上 `SessionHistory`。
- **`/navigator`**：加上「開放報名月份」`UpcomingSessions` 與 `SessionHistory`。
- **頁尾聯繫區**抽成 `components/LineContact.tsx`（內嵌 QR＋加友＋信箱複製），四頁共用；四頁的死複製鈕全部換成 `CopyButton`。
- **`useSessionCardToggle` 與 `.session-header`／`.session-content` CSS 一併移除**——手寫摺疊卡已不存在，這個 hook 沒有任何掛載點了。
- **內容清理**：`src/content/` 移除 6 篇的「Notion 備份 id」引用、`《子頁面》`／`《子資料庫》`（id=…）佔位共 18 處、空的 `💬` 段落 18 個、114 年（2025）過期活動廣告與其仍有效的 Meet 連結 2 處、重複段落與相鄰重複的圖片／分隔線。死的 Notion 佔位改成真的能點的站內連結（`/map`、`/articles`）。

### 驗收證據（首頁與服務頁）

- 四個公開頁 DOM 實測：`meet.google.com` 連結 0；活動軌跡 首頁 9 筆（線上團體 5＋導航 4）／同儕 5／導航 4／親職 0；每頁 QR 1 個、可用複製鈕 2 顆、`#copyButton` 死鈕 0。
- `src/content/` 關鍵字殘留全數歸零：`Notion`／`Untitled`／`《子頁面》`／`《子資料庫》`／`114年`／`meet.google` 皆為 0。
- typecheck／build／check:operations 全通過；主 bundle 由 267 kB 降至 229 kB。
- `check-admin-operations.mjs` 改為對四頁一起斷言含 `<SessionHistory`、`<LineContact />`，且不得出現 `meet.google.com` 或 `id="copyButton"`。

### 已完成：親職上半年場次補建（migration `20260804000010`，已套用）

`/parent` 的活動軌跡原本是空的——親職 4～6 月場次和導航一樣只存在於手寫卡裡。依站上原本的 8 張場次卡補建為 `done`：四月 2 場（10:00／11:00），五月與六月各 3 場（09:00／10:00／11:00）。

服務頁的固定文字曾寫「每月 2 個時段」，與場次卡不一致。經使用者裁決：**8 場為準**——「每月 2 時段」是早期規劃文案，五、六月實際加開了 09:00 場，這也與下半年直接採三時段的演進一致。軌跡記錄的是實際發生的事。

### 已修：首頁自己內嵌的過期親職區塊

`/parent` 服務頁改讀資料庫時，漏掉了**首頁內嵌的同款區塊**——它仍完整掛著「上半年度開放場次／【四月場次】4/18…【六月場次】6/6／截止日」。這是自動化檢查抓不到的死角（檢查表看的是 Meet 連結與元件是否存在，不是「這段文字是否已經過期」），靠獨立爬站才會現形。已比照服務頁改為 `UpcomingSessions`。

同時修掉報名頁的欄位順序：schema 沒有 `preferredSlots` 錨點時，場次選擇欄原本被接在最後，使用者得先填完個資才看到要選哪一場。改為放在最前面（同儕表單受影響，親職與導航本來就在最前）。

### 已完成：同儕報名表欄位對齊 02_v2（migration `20260804000011`，已套用）

欄位由 3 個補為 5 個：`nickname`＊、`email`＊、`phone`（選填）、`note`（標籤由「想對彥宇說的話（選填）」改為「想聊或想問的話題」，key 不動所以既有 97 筆答案無損）、`attendedBefore`（選填單選：第一次參加／參加過 1–3 次／常客！）。定稿提示語「表單是預先統計人數用的！沒報名也可以當天直接參加。」寫進 `projects.description`，顯示在報名頁標題下。

⚠ 這次改的是 `form_schemas` 與 `projects`，**不需要重新部署前端**——表單完全由資料庫驅動，`db push` 後正式站即刻生效。這正是「不寫一次性頁面」那條裁決的實際回報。

**架構定案（經使用者裁決）**：02_v2 把報名畫成服務頁上的彈窗，實作維持獨立的 `/peer-group/register` 路由，**不做彈窗**。理由：①表單統一由 `form_schemas` 驅動，做彈窗等於維護第二套表單路徑；②獨立網址才能貼進 LINE 宣傳與通知信；③與親職、導航行為一致。彈窗只是呈現手法，欄位、提示語與場次卡的精神都已保留。

## Phase 2 完成（2026-08-04）

四個公開頁與三個報名頁全部改為資料庫驅動並上線驗收。最初健檢的四大重症歸零，且每一項都有 CI 守門防止復發：

| 症狀 | 現況 | 守門 |
|---|---|---|
| 內容過期（寫死場次表） | 0 | `check:operations` 禁用 `上半年度開放場次`／`【四月場次】`…／`截止日：` |
| 報名空轉（靜態時段、無法追蹤） | 0 | 禁止 `RegisterPage` 出現靜態時段 fallback |
| Meet 連結外洩 | 0 | 四頁禁用 `meet.google.com`＋`sessions_public` 不含 `meet_url` |
| 死按鈕（`id="copyButton"` 無 handler） | 0 | 四頁禁用 `id="copyButton"` |

**這次學到的教訓已寫進守門**：原本的檢查斷言「元件在不在」，那永遠抓不到「內容過期」——首頁自己內嵌的那份親職過期場次表在所有檢查下都是綠的，是靠獨立爬站才發現。新守門改為直接禁用會過期的字樣，並以「注入 → CI 紅 → 還原 → CI 綠」實證過它真的會擋。

## 16. 2026-08-04 全面重構 Phase 3（後台，進行中）

### 3-1 資料層（migration `20260804000012`，已套用）

`registrations` 新增三個 03_v4 表格要、但原本沒有的行政欄位。三欄都由行政端填寫，因此比照 `priority`／`next_action_at` 做成獨立欄位，不塞進 `answers`（`answers` 是報名者自己填的，混在一起會分不清誰寫的）：

| 欄位 | 型別 | 決定理由 |
|---|---|---|
| `reminder_sent_at` | timestamptz | 「已寄信提醒」存時間戳而非布林：勾選框照常運作（非 null＝已勾），同時免費得到寄出時間給信件狀態機用 |
| `counselor_confirmed` | boolean（可 null） | 三態精確對應 03_v4 的 —／yes／no |
| `final_slot_at` | timestamptz | 只存開始；候選時段全為 1 小時，行事曆結束時間＝開始＋60 分 |

⚠ **狀態新值 `reschedule`（待改訂時間）不需要任何 DDL**：`registrations.status` 是無 check constraint 的 text，且 `admin_transition_registration` 的釋額清單只有 `rejected/cancelled/withdrawn/canceled`——不含 `reschedule`，所以停在「待改訂時間」的報名**會保留名額**，正是這個狀態的語意。顯示標籤依使用者拍板的對應表改寫（審核中→回信確認中、已確認→報名成功、不符合→退回），**儲存值一個都沒動，既有報名零遷移**。

驗收：25 版 local／remote 對齊；PostgREST 探測三個新欄位皆回 200（RLS 擋列但欄位存在），對照組假欄位回 400 `42703`，證明測試分得出「欄位不存在」與「被 RLS 擋」。

### 3-2／3-3 後台報名工作台改為 03_v4 版型

原本是「左列表＋右詳情」的 master-detail，03_v4 要的是**依專案分頁的表格＋格內直接編輯**，因此是版型置換而非加欄位。

- **分頁**：導航計畫／親職諮詢／同儕聚會／全部，各帶筆數。「全部」是安全網——專案沒有對應分頁的報名不會消失。
- **格內編輯**：狀態下拉（即時換色並立刻走 `admin_transition_registration`，名額同步）、已寄信提醒勾選框（寫時間戳）、諮商師回覆確認三態、最終確定時段 datetime、確定場次下拉（走 `admin_move_registration_sessions` 原子移轉）、同儕信箱欄（離開欄位才送出）。
- **抽屜**收下原詳情的全部功能（表單內容、場次移轉、內部註記、轉案、建立追蹤、信件往來連結），版型置換沒有掉任何能力。另加「本月候選時段」快填鈕，★ 標出報名者勾過的。
- **欄位設定驅動**：`RegistrationTable.tsx` 的 `NAVIGATOR_COLUMNS`／`PARENT_COLUMNS`／`PEER_COLUMNS` 只是設定，表格本身不因分頁而分岔。

⚠ **與 03_v4 的一處刻意不一致**：定稿在親職分頁畫的處理狀態是另一組值（待處理／已聯繫／已完成／已取消）。實作**沿用使用者拍板的單一狀態表**，只把表頭寫成「處理狀態」。理由：那張對應表是已鎖的裁決，兩套狀態機會讓同一筆報名在不同分頁顯示不同狀態。

⚠ 同儕分頁最後一欄，03_v4 畫的是「提醒信・已排程」。排程寄送屬 Phase 4，因此先掛既有的「已寄信提醒」欄，不做假的排程狀態。

**信箱同步**：同儕分頁可直接改信箱。`registrations.email` 是名冊比對鍵、`answers.email` 是表單答案，只改一邊會各說各話，因此一次寫兩邊（migration `20260804000014` 把 email 納入編輯稽核）。

### 修改歷程（migration `20260804000013`、`20260804000014`，已套用）

格內編輯是對 `registrations` 直接 update，繞過原本唯一會寫稽核的 `admin_transition_registration`，所以裁決 11 的「修改需記錄歷程」原本會整段落空。新增 trigger `trg_registrations_admin_audit`：

- 記 `email`／`reminder_sent_at`／`counselor_confirmed`／`final_slot_at`／`priority`／`assigned_to`／`next_action_at`／`session_ids` 的前後值
- **不記 `status`**——`admin_transition_registration` 已寫過一筆，重複記會讓同一動作在稽核頁出現兩列
- `answers` **只記被改的 key 名稱、不記內容**：報名答案含個資，稽核表不該成為第二份個資副本

### 3-3 修補：舊平面 key 的顯示 fallback（監督代驗抓到）

親職分頁孩子欄上線後**19 筆真實報名全部顯示「—」**。根因：只讀新的 `children` 群組，而**現有報名一筆都沒有用群組格式**（`answers ? 'children'` 為 false 者 19／19）。用新格式假資料測起來全綠，真實資料全隱形——這是本輪最值得記住的教訓：**測試資料的形狀必須取自真實資料，不能取自新 schema**。

順著這條線清點親職 `answers` 的 key（唯讀查詢，只取 key 名與筆數），發現同類的隱形欄位共三組：

| legacy key | 筆數 | 值的形狀 | 處理 |
|---|---|---|---|
| `childName`／`childGender`／`childAge`／`childGrade`／`childStatus`／`childMedication`／`childOtherConditions` | 最多 19 | 平面字串 | 合成單一孩子標籤，細節進 tooltip |
| `reminderSent` | 13 | `是`（12）／`否`（1） | 勾選框仍只綁 `reminder_sent_at`，舊值另標「歷史：是」 |
| `finalSlot` | 10 | `【五月場】5/23（六）11:00–12:00` 陣列 | 原樣顯示 |

⚠ **三組都只做顯示 fallback，不回填**：`reminderSent` 沒有寄出時間、`finalSlot` 原文**沒有年份**，硬轉成 timestamp 等於猜。要落成正式時間就由行政端在該格自己填。`childAge` 舊資料有的填「8」有的填「8歲」，補單位前先判斷。

驗證：五種情況以真實舊格式渲染實測——舊平面（帶／不帶單位）、新群組（多筆）、兩者皆無（顯示「—」）、新欄位已有值（歷史標記自動消失）。

### CI 守門新增

`check:operations` 現在斷言每一格的寫入呼叫（`reminderSentAt:`／`counselorConfirmed:`／`finalSlotAt:`／`row.setStatus(`／`row.setSessions(`／`row.patch({ email:`）、三組欄位常數都在、狀態標籤符合定稿且**禁用**舊用語（`reviewing: '審核中'` 等），以及兩支稽核 migration 的關鍵字。理由與 Phase 2 相同：「元件在不在」抓不到「這一格變成裝飾品」。已用「注入 → CI 紅 → 還原 → CI 綠」實證。

### 驗收證據（3-2／3-3）

後台在 `RequireAuth`＋`RequireAdmin` 之後且走 Google OAuth，AI 不持有帳號，因此表格互動改以「在 dev server 上用假資料實際渲染元件並模擬事件」驗證，再由使用者於監督視窗以真實登入代驗：

- 導航：狀態下拉→`setStatus('reschedule')`；勾選框→`patch({reminderSentAt:null})`；三態→`patch({counselorConfirmed:false})`；`2026-09-14T20:00`→`patch({finalSlotAt:'2026-09-14T12:00:00.000Z'})`（+8 換算無誤差）；點姓名→開抽屜。表頭八欄與定稿逐字相同。
- 親職：表頭九欄正確；孩子群組渲染成「小恩・男・8 歲・目前服藥中」多個標籤；出席方式合成「與他人一同出席・孩子」；場次下拉→`setSessions(['s2'])`、選「未指定」→`setSessions([])`。
- 同儕：改信箱離開欄位→`patch({email})`（已 trim）；按 Enter 同樣送出；**清空後離開不送出且自動還原**，清空洗不掉信箱。
- 使用者於監督視窗以真實登入代驗六＋一項全數通過（含稽核四筆精準入帳、狀態變更不重複記），測試資料為 `phase1-test` 且已全數還原。

## 14. 2026-08-04 全面重構 Phase 1 主體

### 變更內容

`20260804000002_phase1_groups_mailstate_documents.sql`：

- **共用**：新增 `public.is_ops_admin(uid)`（系統擁有者或任一專案 owner／admin_collab）。`sessions` 擴充 `registration_deadline`、`slot_options jsonb`、`quota_group`、`admin_note`；親職既有 15 場的報名截止依「場次前一週 23:59」回填。
- **同儕聚會**（裁決 3）：下半年 5 場，同 5 日 14:00–16:00，capacity 100。8 月、9 月 `status='open'`；10–12 月 `status='closed'`（建立但未上架，主題與來賓未定）。`closed` 不會出現在 `getUpcomingSessions`（僅取 open/full），符合「即將開放」語意。
- **導航計畫**（裁決 4）：9–12 月各 1 筆 session，`capacity=1`。⚠ **名額模型是「每月 1 位」，不是每時段 1 位**——現行 `enforce_session_capacity()` 逐 session 扣名額，若建 5 筆各 1 名額會變成每月 5 位。因此每月建 1 筆代表該月名額，5 個確切候選時段存於 `slot_options`（後台可逐一手動調整），並加 `quota_group`（`navigator-2026-09` 等）標示名額群組。`starts_at`／`ends_at` 取該月候選時段的最早起與最晚迄，使整個候選窗口都落在 `ends_at >= now()` 的可見範圍內。報名截止＝前一個月 20 日 23:59。四個月全部開放。
- **導航報名表**：新增 `preferredExactSlots` multiselect（20 個確切候選時段，跨月可複選）。
- **聯絡人類群**（計畫第八節）：`contact_groups`／`contact_group_members`，種子 5 個系統類群（講師群、報名者・親職諮詢／導航計畫／同儕聚會、行政協作）；`contacts` 加 `is_favorite` 旗標；`sync_registration_contact_group()` trigger 於 `registrations.contact_id` 掛上時自動把聯絡人加入對應專案的報名者類群。
- **`attendance_confirmations`**：一次性 token（信中「確認出席／請假改期」按鈕），含 `action`、`responded_at`、`expires_at`（預設 30 天）。
- **`generated_documents`**：文件生成紀錄（類型、範圍、對象、內容、狀態、`redacted` 旗標）。
- **信件狀態機**（計畫第七節）：`email_threads` 加 `mail_state`（8 種狀態）、`mail_state_override`＋覆寫者／原因／時間、`last_outbound_at`／`last_inbound_at`／`follow_up_due_at`。顯示以覆寫值優先。
- **`email_templates`**：INSERT 8 範本（確認信、出席確認信〔催覆〕、聯繫信、回絕信修訂版、講師行前通知信、家長行前信、月度宣傳信、客座邀請信）。**既有 2 筆完全未動**（以 `name` 做 NOT EXISTS 判定）。回絕信與家長行前信全文取自審閱指南 v3，其餘 6 封為草稿，需經使用者審閱。
- **RLS**：四張新表一律 `is_ops_admin` 限定，並 `revoke all from anon`。
- **`sessions_public`**：以 `create or replace view` 在既有欄位後追加 `registration_deadline`、`slot_options`、`quota_group`；`meet_url`／`calendar_event_id` 仍不外流。

`20260804000003_navigator_title_clarify.sql`：導航場次標題補「（每月 1 位・確切時段另行確認）」，因月份窗口跨日時現行 `formatSlot` 會顯示成「20:00–10:00」易生誤解。Phase 2 新版導航頁改讀 `slot_options` 後可移除此補述。

### 個資邊界

計畫第四節第 3 點列出的常用聯絡人（鏡子、Lisa、張正怡）**信箱未寫入 Git migration**；本階段只建立 `is_favorite` 欄位與類群結構，實際人員建檔由後台操作處理。

### 驗收證據

- `migration list --linked`：**15 個版本 local／remote 全部成對，單邊 0**。
- 資料表列數：`sessions` 30（原 6 ＋親職 15 ＋同儕 5 ＋導航 4）、`contact_groups` 5、`email_templates` 10（原 2 ＋新 8）、`contact_group_members`／`attendance_confirmations`／`generated_documents` 皆 0（空結構待使用）。
- `sessions_public` 欄位確認含 `registration_deadline`、`slot_options`、`quota_group`。
- 親職 15 場報名截止回填正確，與 01_v3 逐一吻合（8/16→8/9、9/6→8/30、10/11→10/4、11/8→11/1、12/20→12/13），無空值。
- 正式站 390px 前台實測（皆 `scrollWidth == clientWidth`，溢位 0）：
  - `/navigator/register`：4 個月份場次各「剩 1 名」（每月 1 位模型正確）、20 個確切候選時段全部列出。
  - `/peer-group/register`：只出現 8 月與 9 月（open），10–12 月未上架不顯示。
  - `/parent/register`：15 場全部可選，12/20 11:00 已回復「剩 1 名」。
