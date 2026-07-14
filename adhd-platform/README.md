# adhd-platform

ADHD 專案行政管理系統 —— 公開前台 + `/admin` 後台，單一程式庫、單次建置。
技術棧與資料夾所有權見 `../AI協作指令/00_共同規範與介面契約.md`。

## 開發

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b + vite build
npm run typecheck  # tsc -b（零錯誤為驗收條件）
npm run deploy     # 建置 + 產生 404.html/.nojekyll（見 DEPLOY.md）
```

## 資料夾所有權（鐵則：只改自己的）

| 路徑 | 擁有者 |
|---|---|
| `contracts/`、`supabase/`、`scripts/`、`src/lib/`、`src/router.tsx`、`src/App.tsx`、`src/routes/`、`src/admin/`、`src/styles/tokens.css` | **CLAUDE** |
| `src/components/ui/`、`src/features/` | **CODEX** |
| `src/pages/public/`、`src/content/`、`src/data/`、`public/assets/` | **ANTIGRAVITY** |

`contracts/types.ts` 與 `src/styles/tokens.css` 一律 import 使用、絕不修改。

## 現況（骨架 v0.1）

- ✅ Vite + React + TS + Tailwind，tokens 雙軌（`tailwind.config.js` + `src/styles/tokens.css`）
- ✅ `contracts/types.ts` 完整型別契約
- ✅ 路由：公開頁 + `/admin` 殼（登入守衛占位，DEV 旁路）
- ✅ 部署腳本 + GitHub Actions workflow（base path、SPA 404 fallback）
- ⏳ 自托管字體：`@font-face` 已就緒，woff2 檔待放入 `public/fonts/`（見該資料夾 README；未放入自動 fallback）
- ⏳ 各頁面/元件為占位，待 CODEX/ANTIGRAVITY 交付後由 CLAUDE 串接
- ⏳ Supabase schema/RLS/Edge Functions（K1–K2）、認證（K3）、資料遷移（K4）
