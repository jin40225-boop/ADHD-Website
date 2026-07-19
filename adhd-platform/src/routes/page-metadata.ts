import articleIndex from '@/data/articles-index.json';
import siteMeta from '@/data/site-meta.json';

const SITE_URL = 'https://jin40225-boop.github.io/ADHD-Website/';
const DEFAULT_META = siteMeta[0];

type PageMeta = { route: string; title: string; description: string };
type ArticleMeta = { slug: string; title: string };

function resolvePageMeta(pathname: string): PageMeta {
  const normalizedPath = pathname !== '/' ? pathname.replace(/\/$/, '') : '/';
  const exact = (siteMeta as PageMeta[]).find((item) => item.route === normalizedPath);
  if (exact) return exact;

  if (normalizedPath.startsWith('/articles/')) {
    const slug = normalizedPath.slice('/articles/'.length);
    const article = (articleIndex as ArticleMeta[]).find((item) => item.slug === slug);
    if (article) {
      return {
        route: normalizedPath,
        title: `${article.title}｜大A彥宇`,
        description: `閱讀「${article.title}」的 ADHD 入門整理與相關資源。`,
      };
    }
  }

  return DEFAULT_META;
}

function setMetaContent(selector: string, value: string) {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', value);
}

/** 同步 SPA 路由的 title、canonical、description 與社群分享 metadata。 */
export function applyPageMetadata(pathname: string) {
  const meta = resolvePageMeta(pathname);
  const route = meta.route === '/' ? '' : meta.route.replace(/^\//, '');
  const canonical = new URL(route, SITE_URL).href;

  document.documentElement.lang = 'zh-Hant';
  document.title = meta.title;
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', canonical);
  setMetaContent('meta[name="description"]', meta.description);
  setMetaContent('meta[property="og:title"]', meta.title);
  setMetaContent('meta[property="og:description"]', meta.description);
  setMetaContent('meta[property="og:url"]', canonical);
  setMetaContent('meta[name="twitter:title"]', meta.title);
  setMetaContent('meta[name="twitter:description"]', meta.description);
}