/**
 * GitHub Pages 部署後處理腳本。【CLAUDE】
 *
 * 動作：
 *  1. 執行 production build（vite build，base = /ADHD-Website/）。
 *  2. SPA fallback：複製 dist/index.html → dist/404.html
 *     （GitHub Pages 對未知路徑回傳 404.html，內含同一支 SPA，router 依網址接手）。
 *  3. 建立 dist/.nojekyll（避免 GitHub 用 Jekyll 忽略底線開頭檔）。
 *
 * 用法：
 *   npm run deploy            # 產出可部署的 dist/
 * 之後將 dist/ 內容推到 GitHub Pages（見 DEPLOY.md，或用 .github/workflows/deploy.yml 自動化）。
 * 本腳本「不」自動 push —— 對外發布屬需人工確認的動作。
 */
import { execSync } from 'node:child_process';
import { copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

console.log('▶ 建置 production（vite build）…');
execSync('npm run build', { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });

const indexHtml = resolve(dist, 'index.html');
if (!existsSync(indexHtml)) {
  console.error('✗ 找不到 dist/index.html，建置可能失敗。');
  process.exit(1);
}

copyFileSync(indexHtml, resolve(dist, '404.html'));
console.log('✔ 已建立 dist/404.html（SPA fallback）');

writeFileSync(resolve(dist, '.nojekyll'), '');
console.log('✔ 已建立 dist/.nojekyll');

console.log('\n完成。dist/ 已可部署。發布步驟見 DEPLOY.md。');
