# ADHD 家長支持平台：正式基準、目前狀態與重啟指南

基準建立日期：2026-07-24（Asia/Taipei）
狀態：正式上線，後續維運
本文件定位：專案技術狀態的單一事實來源。每次正式發布、資料庫結構變更或外部整合狀態改變後，更新本文件並在最下方新增一筆紀錄。

## 1. 正式基準

| 項目 | 基準值 |
|---|---|
| GitHub repository | `jin40225-boop/ADHD-Website` |
| 正式 branch | `main` |
| 正式程式 commit | `60230a2eb745d2173d930de19ea881f99aa47538` |
| Commit 主旨 | `feat: build integrated admin operations hub` |
| 正式網站 | <https://jin40225-boop.github.io/ADHD-Website/> |
| GitHub Pages workflow | <https://github.com/jin40225-boop/ADHD-Website/actions/runs/30099005645> |
| Workflow 結果 | `completed / success` |
| Workflow 完成時間 | `2026-07-24T13:58:39Z` |
| 正式前端資源識別 | `assets/index-Emap0En6.js` |
| Supabase project ref | `sssseazkhiswjhtmbluh` |
| Production base | `/ADHD-Website/` |

正式程式 commit 與「文件更新 commit」是兩個不同概念。此頁所稱正式程式基準固定指 `60230a2`；若後續只有文件異動，不得誤記為已部署新版功能。

## 2. 權威 checkout 與副本邊界

在本工作區中，正式 checkout 為：

```text
ADHD專管系統/
└─ ADHD-Website-release/       ← Git root
   └─ adhd-platform/           ← React／Supabase app
```

開始工作前必須驗證：

```powershell
Set-Location "<ADHD專管系統>\ADHD-Website-release"
git rev-parse --show-toplevel
git remote get-url origin
git status -sb
git log -1 --format="%H %s"
```

預期 remote 為 `https://github.com/jin40225-boop/ADHD-Website.git`。同層的 `adhd-platform/`、`_codex_maintenance/` 與 `antigravity-staging/` 不是正式來源，不可直接覆蓋正式 checkout。

## 3. 系統架構基準

- 前端：React 18、TypeScript、Vite 5、React Router、Tailwind。
- 託管：GitHub Pages，深層路由由部署腳本產生獨立 `index.html`。
- 後端：Supabase PostgreSQL、Auth、RLS、Storage 與 Edge Functions。
- 身分：Google OAuth；後台同時受登入與應用層管理角色攔截。
- 公開 GPT：唯讀 MCP，只能查公開服務、公開場次、公開推薦與公開資源。
- 個資邊界：報名、個案、信件、附件、Meet URL、Calendar ID 與管理資料不得進入公開 MCP 或 Git repository。
- 發布邊界：GitHub Actions 只部署前端；Supabase migration、Function 與 secrets 需另行發布及驗證。

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
| Gmail 首次同步 | 功能已部署，正式帳號尚未執行首次同步 | 管理者手動同步後，確認收件、寄件、未讀、thread、附件與 audit |
| Gmail 自動推播 | 尚未實作 `users.watch` 自動續訂 | 建立 watch／Pub/Sub、續訂排程、失敗告警與重放驗證 |
| 真實寄信 | 僅完成安全驗證，未自動寄給真實對象 | 指定測試收件者，確認 Gmail thread、DB message 與 audit 一致 |
| Calendar／Meet | 程式與接點存在，尚未做本輪真實 E2E | 指定測試場次，確認事件、Meet URL、DB 回寫與重試 |
| CAPTCHA | 後端可讀 `TURNSTILE_SECRET_KEY`，前端 widget 未啟用 | 前後端 token 流程、錯誤 UX 與無障礙驗證完成 |
| 速率限制 | 已啟用 | 持續監測誤擋、繞過與管理者查核方式 |

「檔案存在」、「Function 已部署」或「測試回傳 400／401」不等於外部服務端到端完成；上述缺口必須用指定測試帳號與測試資料驗收後才能關閉。

## 7. 重啟工作程序

### A. 先恢復事實

```powershell
Set-Location "<ADHD專管系統>\ADHD-Website-release"
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

1. 以指定測試帳號完成 Gmail 首次同步與一封測試往返信。
2. 完成 Calendar／Meet 真實場次 E2E。
3. 實作 Gmail `users.watch`、續訂與錯誤監控。
4. 補上前端 Turnstile widget 並驗證無障礙與誤擋處理。
5. 根據實際行政操作回饋，調整狀態字典、批次操作、工作佇列與報表。

## 9. 更新紀錄

| 日期 | 程式基準 | 狀態 | 證據 |
|---|---|---|---|
| 2026-07-24 | `60230a2` | 整合行政營運中心正式上線；資料庫 migration 與 4 個新 Functions 已發布 | Actions `30099005645`、正式路由抽查、登入後台桌面／行動版驗證 |
