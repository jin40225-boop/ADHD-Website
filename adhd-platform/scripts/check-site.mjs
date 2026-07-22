import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const siteUrl = 'https://jin40225-boop.github.io/ADHD-Website/';
const siteMeta = JSON.parse(readFileSync(resolve(root, 'src/data/site-meta.json'), 'utf8'));
const articleIndex = JSON.parse(readFileSync(resolve(root, 'src/data/articles-index.json'), 'utf8'));
const routes = [
  ...siteMeta,
  ...articleIndex.map((article) => ({ route: `/articles/${article.slug}`, title: `${article.title}｜大A彥宇` })),
];
const failures = [];

function collectFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(dir, entry.name);
    return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

for (const required of ['index.html', '404.html', '.nojekyll', 'gpt-tools.json']) {
  if (!existsSync(resolve(dist, required))) failures.push(`缺少 dist/${required}`);
}

for (const meta of routes) {
  const routePath = meta.route === '/' ? 'index.html' : `${meta.route.replace(/^\//, '')}/index.html`;
  const filePath = resolve(dist, routePath);
  if (!existsSync(filePath)) {
    failures.push(`缺少深層路由檔案 ${routePath}`);
    continue;
  }
  const html = readFileSync(filePath, 'utf8');
  const route = meta.route === '/' ? '' : meta.route.replace(/^\//, '');
  const canonical = new URL(route, siteUrl).href;
  if (!html.includes(`<title>${meta.title}</title>`)) failures.push(`${routePath} title 不符`);
  if (!html.includes(`<link rel="canonical" href="${canonical}" />`)) failures.push(`${routePath} canonical 不符`);
}

const sourceFiles = collectFiles(resolve(root, 'src/content')).filter((file) => /\.(tsx|ts)$/.test(file));
for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf8');
  if (/src=["']\/assets\//.test(content)) failures.push(`${file} 仍含根路徑圖片`);
  if (/<img(?![^>]*\balt=)[^>]*>/s.test(content)) failures.push(`${file} 含缺少 alt 的圖片`);
}

const publicSourceFiles = [
  ...collectFiles(resolve(root, 'src/content')),
  ...collectFiles(resolve(root, 'src/pages/public')),
].filter((file) => /\.(tsx|ts|md)$/.test(file));
for (const file of publicSourceFiles) {
  const content = readFileSync(file, 'utf8');
  if (/notion\.site|forms\.gle/i.test(content)) {
    failures.push(`${file} 仍含舊外部站台或表單依賴`);
  }
}

const integrationRequirements = [
  ['src/pages/public/RecommendationMapPage.tsx', ['getPublicRecommendations', '內建備份（2026-07-11）']],
  ['src/admin/pages/RecommendationsPage.tsx', ['adminSaveRecommendation', 'getPublicRecommendations']],
  ['src/admin/pages/TemplatesPage.tsx', ['adminSaveEmailTemplate', 'adminDeleteEmailTemplate']],
  ['src/admin/pages/CasesPage.tsx', ['adminListCasesWithRecords', 'adminAddServiceRecord']],
  ['src/admin/pages/InstructorSchedulingPage.tsx', ['adminListAvailabilityPolls', 'invokeSendInstructorInvite', 'adminConfirmAvailabilityPoll']],
  ['src/pages/InstructorAvailabilityPage.tsx', ['getAvailabilityPoll', 'saveAvailabilityReply']],
  ['src/admin/AdminLayout.tsx', ['applyPageMetadata']],
  ['src/admin/AdminLogin.tsx', ['applyPageMetadata']],
  ['supabase/functions/mcp/index.ts', ['list_services', 'list_upcoming_sessions', 'search_recommendations', 'list_public_resources', 'sessions_public']],
];
for (const [relativePath, markers] of integrationRequirements) {
  const content = readFileSync(resolve(root, relativePath), 'utf8');
  for (const marker of markers) {
    if (!content.includes(marker)) failures.push(`${relativePath} 缺少資料接線 ${marker}`);
  }
}

const staleIntegrationCopy = collectFiles(resolve(root, 'src'))
  .filter((file) => /\.(tsx|ts)$/.test(file))
  .filter((file) => readFileSync(file, 'utf8').includes('前台地圖仍讀 recommendations.json'));
if (staleIntegrationCopy.length) failures.push('仍含推薦資料三處同步的過期說明');
const staleInstructorCopy = collectFiles(resolve(root, 'src'))
  .filter((file) => /\.(tsx|ts)$/.test(file))
  .filter((file) => /講師邀約目前仍為示意模式|示意模式：候選時段/.test(readFileSync(file, 'utf8')));
if (staleInstructorCopy.length) failures.push('仍含講師邀約示意模式的過期說明');

const gptDescriptor = JSON.parse(readFileSync(resolve(root, 'public/gpt-tools.json'), 'utf8'));
if (gptDescriptor.mcpEndpoint !== 'https://sssseazkhiswjhtmbluh.supabase.co/functions/v1/mcp') {
  failures.push('gpt-tools.json MCP endpoint 不符');
}
if (gptDescriptor.privacy?.readOnly !== true || gptDescriptor.privacy?.publicDataOnly !== true) {
  failures.push('gpt-tools.json 缺少唯讀公開資料聲明');
}

const mcpSource = readFileSync(resolve(root, 'supabase/functions/mcp/index.ts'), 'utf8');
for (const forbiddenTable of ['registrations', 'cases', 'service_records', 'email_messages', 'profiles']) {
  if (mcpSource.includes(`'${forbiddenTable}'`)) {
    failures.push(`公開 MCP 不得查詢 ${forbiddenTable}`);
  }
}

if (failures.length) {  console.error(failures.map((failure) => `✗ ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`✔ Site check passed：${routes.length} 個路由、${sourceFiles.length} 個內容檔案`);