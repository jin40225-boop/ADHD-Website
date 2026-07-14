/**
 * 後台版型骨架（/admin）。【CLAUDE】
 * 側欄連到各功能模組占位；CODEX 的 features 交付後於 router.tsx 換入真元件。
 */
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

const ADMIN_NAV = [
  { to: '/admin', label: '總覽', end: true },
  { to: '/admin/registrations', label: '報名審核' },
  { to: '/admin/sessions', label: '場次管理' },
  { to: '/admin/instructors', label: '講師邀約' },
  { to: '/admin/recommendations', label: '推薦審核' },
  { to: '/admin/templates', label: '信件範本' },
  { to: '/admin/cases', label: '個案管理' },
];

export default function AdminLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen bg-cream">
      <aside className="w-56 shrink-0 border-r-2 border-brown bg-base-yellow/60 p-4">
        <Link to="/admin" className="mb-6 block font-heading text-lg font-bold">
          行政後台
        </Link>
        <nav className="flex flex-col gap-1 text-sm">
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 hover:bg-white/60 ${
                  isActive ? 'bg-white font-bold shadow-warm-sm' : ''
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-8 border-t border-brown/30 pt-4 text-xs text-brown/70">
          <p>{user ? user.displayName : '（開發模式・未登入）'}</p>
          <button onClick={() => void signOut()} className="mt-2 underline">
            登出
          </button>
          <Link to="/" className="mt-1 block underline">回前台</Link>
        </div>
      </aside>

      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
