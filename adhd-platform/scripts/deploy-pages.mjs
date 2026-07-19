/**
 * GitHub Pages 部署後處理腳本。【CLAUDE / CODEX 維護】
 *
 * 1. 執行 production build。
 * 2. 為已知路由建立 route/index.html，讓 GitHub Pages 深層網址回傳 200。
 * 3. 建立 404.html 作為未知 SPA 路由 fallback。
 * 4. 建立 .nojekyll。
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const siteUrl = 'https://jin40225-boop.github.io/ADHD-Website/';
const siteMeta = JSON.parse(readFileSync(resolve(root, 'src/data/site-meta.json'), 'utf8'));
const articleIndex = JSON.parse(readFileSync(resolve(root, 'src/data/articles-index.json'), 'utf8'));
const articleMeta = articleIndex.map((article) => ({
  route: `/articles/${article.slug}`,
  title: `${article.title}｜大A彥宇`,
  description: `閱讀「${article.title}」的 ADHD 入門整理與相關資源。`,
}));
const routes = [...siteMeta, ...articleMeta];

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function renderRouteHtml(source, meta) {
  const route = meta.route === '/' ? '' : meta.route.replace(/^\//, '');
  const canonical = new URL(route, siteUrl).href;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  return source
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${description}" />`);
}

console.log('▶ 建置 production（vite build）…');
execSync('npm run build', { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });

const indexHtmlPath = resolve(dist, 'index.html');
if (!existsSync(indexHtmlPath)) {
  console.error('✗ 找不到 dist/index.html，建置可能失敗。');
  process.exit(1);
}
const indexHtml = readFileSync(indexHtmlPath, 'utf8');

for (const meta of routes) {
  if (meta.route === '/') continue;
  const routeDir = resolve(dist, meta.route.replace(/^\//, ''));
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(resolve(routeDir, 'index.html'), renderRouteHtml(indexHtml, meta));
}
console.log(`✔ 已建立 ${routes.length - 1} 個深層路由 index.html（HTTP 200）`);

writeFileSync(resolve(dist, '404.html'), indexHtml);
console.log('✔ 已建立 dist/404.html（未知路由 SPA fallback）');

writeFileSync(resolve(dist, '.nojekyll'), '');
console.log('✔ 已建立 dist/.nojekyll');
console.log('\n完成。dist/ 已可部署。');