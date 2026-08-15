# Codex 接管基準與維運界線

建立日期：2026-08-15（Asia/Taipei）
狀態：接管初始快照；本次不修改網站功能或正式資料。

## 1. 權威版本

| 項目 | 接管基準 |
|---|---|
| GitHub repository | `jin40225-boop/ADHD-Website` |
| 正式 branch | `main` |
| 功能基準 commit | `756462214dc144679b6a6f32c3e6e6091bb7bc4b` |
| 接管里程碑 | Git tag `codex-maintenance-baseline-2026-08-15` |
| 正式站 | <https://jin40225-boop.github.io/ADHD-Website/> |
| 接管前 Pages run | `31459031668` / success |
| 線上 JS bundle | `assets/index-V-YSIL9W.js` |
| 本機維運 checkout | `C:\Dev\ADHD-Website-maintenance` |
| Supabase project ref | `sssseazkhiswjhtmbluh` |

使用者已裁決「目前線上版本為最新」。因此開工時先同步 `origin/main`，再由成功 Pages run 與正式站證明部署；不以任一舊路徑或離線副本覆蓋線上。

## 2. 2026-08-15 現況盤點

- 前端：React 18、TypeScript、Vite 5、GitHub Pages。目前盤點 35 個 page/route 程式檔。
- 後端：Supabase PostgreSQL/Auth/RLS/Storage/Edge Functions，並與 `personal_assistant` schema 共用同一 project。
- Migration：53 個本地版本與 53 個 linked remote 版本逐筆成對，沒有漂移。
- Edge Functions：遠端實查 13 支，皆為 `ACTIVE`；本 repo 有 12 個函式目錄加 `_shared`。`line-webhook` 與 `reminder-cron` 顯示來自共用 LINE 助理發布流，不能由本網站 repo 擅自覆蓋。
- GitHub Actions secrets 已有 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`；僅核對鍵名存在，未讀取或記錄值。
- 維運工具：Git 2.53.0、GitHub CLI 2.89.0、Node 24.14.0、npm 11.9.0、Deno 2.7.13、Python 3.12.10。全域 Codex CLI 仍為 0.118.0；已用不改系統環境的 `npx @openai/codex@0.147.0` 實際啟動 Luna 唯讀代理成功。

## 3. 接管前驗證

```text
npm ci                                      PASS
npm audit --omit=dev --audit-level=high    PASS（CI 準確門檻）
npm run typecheck                           PASS
npm run check:operations                    PASS
npm run deploy                              PASS（40 deep routes）
npm run check:site                          PASS（41 routes、9 content files）
supabase migration list --linked            PASS（53 local = 53 remote）
supabase inspect db table-stats --linked    PASS
supabase functions list                     PASS（13 ACTIVE）
```

完整 `npm audit` 仍有 5 項（3 moderate、2 high），主要在 Vite/esbuild/nanoid 開發工具鏈；production-only 有 React Router 2 項 moderate，未超過現行 CI 的 high 失敗門檻。不在本次無功能變更接管中強升 major dependency，另列為後續專項。

## 4. 代理與 Skill

- 專案 Skill：`.agents/skills/adhd-website-maintainer/`，規定版本對齊、分層測試、隱私、GitHub Pages 與 Supabase 發布界線。
- 低成本內容代理：`.codex/agents/content-maintainer.toml`，使用 `gpt-5.6-luna`、medium reasoning、workspace-write；只處理有邊界的內容、無障礙、響應式 UI 與前端實作，禁止 commit/push/deploy 與後端異動。
- 低成本 QA 代理：`.codex/agents/maintenance-auditor.toml`，使用 `gpt-5.6-luna`、medium reasoning、read-only sandbox。
- 差異整合、commit、發布、Supabase/外部整合與最終驗收仍由主代理負責。
- 實際啟動證據：Codex CLI 0.147.0 已原生召喚 `content_maintainer`，正確解析首頁為 `adhd-platform/src/pages/public/HomePage.tsx`，並在 no-edit 測試前後保持 Git 差異不變。

## 5. 維運最短流程

1. 讀 `AGENTS.md`、本文件與相關 `PROJECT_BASELINE.md` 章節。
2. 核對 Git root/remote/status/HEAD，fetch 後從當前 `origin/main` 開 feature branch。
3. 修改內容／UI／功能；保留不屬於當次任務的變更。
4. 執行 CI 同級門檻與受影響路徑的桌機／390px 測試。
5. 查看完整 diff，只 stage 指定檔案。
6. 經發布授權後 push，等待 Actions，再驗正式站與受影響深層路由。
7. 碰到 SQL/RLS/Function/Gmail/Calendar/Meet/secrets 時，另走 Supabase 與外部整合驗收；Pages 成功不代表後端已發布。

## 6. 已知風險與待辦

1. 歷史 `AGENTS.md` 仍寫「程式碼唯一位置是 `D:\ADHD-Website-release`」，但接管時該路徑不可用。本文件記錄現行維運 checkout，但未經明示核可改寫原治理條款。
2. 本機沒有 production env 值，所以本機 Vite bundle hash 不與 CI 產品直接比較；正式對齊以 GitHub Actions 成功與線上路由實測為準。
3. 原私人 `cairn/` 沒有在公開 Git 內；本 checkout 已重建最小私人 ROADMAP/LOG，但不伪稱恢復了舊私人內容。
4. Dependency 漏洞升級要單獨開分支處理，並完整驗收 React Router 行為與 Vite 部署。
5. 全域 Codex CLI 0.118.0 太舊，且全域 config 的 `service_tier = "default"` 已過期。專案 config 已指定 `fast`；未經使用者明示核可，不全域升級或覆寫個人 config。CLI 需要時可先使用已驗證的 `npx -y @openai/codex@0.147.0`。

## 7. 不可混為同一狀態的五個檢查點

1. 本機已修改。
2. 已 commit。
3. 已 push 到 GitHub。
4. GitHub Pages 已成功部署。
5. 正式站或 Supabase/外部整合已用受控方式實測。

只有與當次任務相關的必要檢查點全部成立，才能回報完成。
