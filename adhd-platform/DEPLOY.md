# 部署說明（GitHub Pages）

目標：部署回原網址 `https://jin40225-boop.github.io/ADHD-Website/`（網址不變）。

## Base path

`vite.config.ts` 依 `NODE_ENV` 決定 base：
- production → `/ADHD-Website/`
- 本機 dev → `/`
- 可用環境變數 `VITE_BASE` 覆寫（部署到 Cloudflare Pages / 根網域時設 `/`）。

若 repo 名稱不是 `ADHD-Website`，請同步改 `vite.config.ts` 的 base 或設 `VITE_BASE`。

## SPA fallback（重點）

GitHub Pages 是靜態站，直接開 `/ADHD-Website/map` 這種深層路由會 404。
`npm run deploy` 會把 `dist/index.html` 複製成 `dist/404.html`：GitHub 對未知路徑
回傳 404.html（內含同一支 SPA），react-router 依當前網址接手渲染，深連結即可用。

> 進階：若之後需要保留查詢字串/hash 的完整重導，可改用 rafgraph/spa-github-pages
> 的 404 重導腳本；目前「複製 index.html」對本站路由已足夠。

## 兩種發布方式

### A. GitHub Actions（建議，全自動）

已附 `.github/workflows/deploy.yml`。步驟：
1. 到 repo **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
2. push 到 `main`，workflow 自動 `npm ci && npm run deploy` 並發布。

### B. 手動

```bash
npm run deploy          # 產出 dist/（含 404.html、.nojekyll）
# 再把 dist/ 內容推到 Pages 分支（如 gh-pages）或用 Pages 設定指向 dist
```

> 本專案的 `deploy` 腳本刻意**不自動 push** —— 對外發布屬需人工確認的動作，
> 請自行檢視 `dist/` 後再發布。

## 環境變數

Supabase 連線值放建置環境（Actions Secrets 或本機 `.env`）：
`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`（見 `.env.example`）。
未設定時前台以本地 JSON 資料運作，不會崩潰（骨架/Phase 0 狀態）。
