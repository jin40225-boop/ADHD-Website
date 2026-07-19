/**
 * 公開前台版型。【CLAUDE 整合】
 * NavBar/Footer 採 CODEX 品牌元件；站內連結透過 RouterAnchor 走 SPA 導航
 * （原生 <a href="/..."> 在 GitHub Pages 子路徑部署下會脫離 basename）。
 */
import { forwardRef, useEffect } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Footer, NavBar } from '@/components/ui';
import articleIndex from '@/data/articles-index.json';
import siteMeta from '@/data/site-meta.json';

const NAV = [
  { to: '/', label: '首頁', end: true },
  { to: '/peer-group', label: '互助聚會' },
  { to: '/navigator', label: '心理師諮詢' },
  { to: '/parent', label: '家長諮詢' },
  { to: '/map', label: '就醫推薦' },
  { to: '/guide', label: '新手指南' },
  { to: '/articles', label: '入門文章' },
  { to: '/instructors', label: '講師概況' },
];

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

/** NavBar linkAs 轉接器：站內路徑改用 react-router Link，外部/錨點連結維持原生 <a>。 */
const RouterAnchor = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  function RouterAnchor({ href = '/', children, ...rest }, ref) {
    if (/^(https?:|mailto:|tel:|#)/.test(href)) {
      return (
        <a ref={ref} href={href} {...rest}>
          {children}
        </a>
      );
    }
    return (
      <Link ref={ref} to={href} {...rest}>
        {children}
      </Link>
    );
  },
);

export default function PublicLayout() {
  const { pathname } = useLocation();
  const items = NAV.map((item) => ({
    label: item.label,
    href: item.to,
    current: item.end ? pathname === item.to : pathname.startsWith(item.to),
  }));

  useEffect(() => {
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
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-cream bg-dots">
      <NavBar brand="大A彥宇" homeHref="/" items={items} linkAs={RouterAnchor} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer
        links={[
          { label: '來信打氣', href: 'mailto:jin40225@gmail.com' },
          { label: '互助聚會', href: '/peer-group' },
          { label: '就醫推薦', href: '/map' },
          { label: '活動回饋', href: '/feedback' },
          { label: '管理後台', href: '/admin' },
        ]}
        linkAs={RouterAnchor}
      />
    </div>
  );
}