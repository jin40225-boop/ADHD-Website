/**
 * 公開前台版型。【CLAUDE 整合】
 * NavBar/Footer 採 CODEX 品牌元件；站內連結透過 RouterAnchor 走 SPA 導航
 * （原生 <a href="/..."> 在 GitHub Pages 子路徑部署下會脫離 basename）。
 */
import { forwardRef } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Footer, NavBar } from '@/components/ui';

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

  return (
    <div className="flex min-h-screen flex-col bg-cream bg-dots">
      <NavBar brand="大A彥宇" homeHref="/" items={items} linkAs={RouterAnchor} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer links={[{ label: '來信打氣', href: 'mailto:jin40225@gmail.com' }]} />
    </div>
  );
}
