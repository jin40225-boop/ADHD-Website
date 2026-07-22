# GPT 與 Sites 整合決策

更新日期：2026-07-22

## 結論

正式 GitHub Pages 網站與 Supabase 不搬家。GPT 採用公開、唯讀的 MCP 工具層，負責對話式查找與導流；報名、個資、登入、審核及外部服務操作仍由既有網站與後台負責。Sites 不取代正式站，避免複製 30 個路由、Supabase Auth、RLS 與 GitHub Pages SEO 產物。

## 遷移矩陣

| 能力 | 決策 | 落地方式 |
|---|---|---|
| 公開服務導覽 | 轉入 GPT | `list_services`，回傳服務說明與正式站連結 |
| 公開近期場次 | 轉入 GPT | `list_upcoming_sessions`，只讀 `sessions_public` |
| 公開推薦查找 | 轉入 GPT | `search_recommendations`，只讀已公開推薦並附醫療資訊免責聲明 |
| 指南、文章、講師入口 | 轉入 GPT | `list_public_resources`，導向正式站 |
| 公開網站與 SEO | 維持現有 | GitHub Pages 為 canonical，保留深層路由、metadata 與可及性 |
| Supabase 資料庫 | 維持現有 | PostgreSQL 與 RLS 為唯一資料真相來源 |
| 公開報名與推薦投稿 | 維持現有 | 使用正式網站表單完成告知、欄位驗證與送出 |
| 報名、個案、email、講師回覆 | 不進 GPT | 僅供授權後台依 RLS 存取 |
| Gmail、Calendar、Meet | 不進 GPT | 只由需登入且具專案權限的 Edge Functions 執行 |
| Sites 託管 | 暫不遷移 | 現有 Vite／GitHub Pages 架構已成熟；Sites 僅適合未來獨立的內部輔助面板或原型 |

## 公開 GPT 工具

- MCP endpoint：`https://sssseazkhiswjhtmbluh.supabase.co/functions/v1/mcp`
- Health endpoint：`https://sssseazkhiswjhtmbluh.supabase.co/functions/v1/mcp/health`
- 正式網站描述檔：`/ADHD-Website/gpt-tools.json`
- 實作：`supabase/functions/mcp/index.ts`

MCP Function 使用 Supabase 內建 anon key，且只能查詢 `projects`、`sessions_public` 與 `recommendations`。它不使用 service-role key，不提供寫入工具，也不接受報名或健康個資。

## ChatGPT 連接

1. 部署 `mcp` Edge Function，且關閉 JWT 驗證；Function 自己僅透過 anon/RLS 讀取公開資料。
2. 確認 health endpoint 回傳 `privacy: public-read-only`。
3. 在 ChatGPT 開發者模式新增 MCP app，URL 填入 MCP endpoint。
4. 確認四個工具可見，分別執行服務、場次、推薦與資源查詢。
5. 確認任何報名要求只回傳正式站連結，不在對話工具中蒐集或送出個資。

## 安全邊界

- MCP 僅有 read-only tools，且每個工具宣告 `readOnlyHint`、`destructiveHint: false` 與 `openWorldHint: false`。
- 場次來源固定為 `sessions_public`，不含 `meet_url` 或 `calendar_event_id`。
- 推薦結果不回傳投稿者欄位，經驗內容最多 280 字，並提示原單位確認與非醫療建議。
- 錯誤回應不洩漏資料庫憑證；詳細錯誤只進 Function log。
- 未來若新增寫入工具，必須另建需驗證的 MCP server、明確確認不可逆操作，不能擴張此公開 endpoint。

## 驗收

~~~bash
deno check --node-modules-dir=auto supabase/functions/mcp/index.ts
npm run typecheck
npm run deploy
npm run check:site
~~~

2026-07-22 已完成 MCP `initialize`、`tools/list`、四個 `tools/call` 與 ChatGPT `list_services` 對話端到端測試。回應未出現 email、報名 answers、個案紀錄、Meet URL 或 Calendar event ID。
