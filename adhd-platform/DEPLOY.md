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