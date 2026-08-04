import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  CalendarDays, CalendarRange, ClipboardCheck, FilePenLine, FileText, GraduationCap,
  HeartHandshake, Inbox, LayoutDashboard, ListTodo, MapPinned, Menu,
  MessageSquareHeart, PlugZap, ScrollText, Send, Settings, ShieldCheck, Users, X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { applyPageMetadata } from '@/routes/page-metadata';
import './operations/operations.css';

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: '今日工作', items: [
    { to: '/admin', label: '工作總覽', icon: LayoutDashboard, end: true },
    { to: '/admin/tasks', label: '追蹤任務', icon: ListTodo },
    { to: '/admin/inbox', label: '整合收件匣', icon: Inbox },
  ]},
  { label: '人員與服務', items: [
    { to: '/admin/people', label: '人員主檔', icon: Users },
    { to: '/admin/registrations', label: '報名審核', icon: ClipboardCheck },
    { to: '/admin/cases', label: '個案管理', icon: HeartHandshake },
    { to: '/admin/instructors', label: '講師與邀約', icon: GraduationCap },
  ]},
  { label: '活動營運', items: [
    { to: '/admin/activities', label: '活動中心', icon: CalendarRange },
    { to: '/admin/sessions', label: '場次與行事曆', icon: CalendarDays },
    { to: '/admin/forms', label: '報名表設定', icon: FilePenLine },
    { to: '/admin/templates', label: '信件範本', icon: Send },
    { to: '/admin/documents', label: '文件產生中心', icon: FileText },
  ]},
  { label: '內容與系統', items: [
    { to: '/admin/recommendations', label: '推薦資料審核', icon: MapPinned },
    { to: '/admin/feedback', label: '活動回饋', icon: MessageSquareHeart },
    { to: '/admin/team', label: '成員與權限', icon: ShieldCheck },
    { to: '/admin/settings', label: '設定・聯絡人', icon: Settings },
    { to: '/admin/integrations', label: '整合健康度', icon: PlugZap },
    { to: '/admin/audit', label: '稽核紀錄', icon: ScrollText },
  ]},
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="ops-nav" aria-label="行政後台主選單">
      {NAV_GROUPS.map((group) => (
        <section className="ops-nav-group" key={group.label}>
          <span className="ops-nav-label">{group.label}</span>
          {group.items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onNavigate} className={({ isActive }) => `ops-nav-link ${isActive ? 'ops-nav-link--active' : ''}`}>
              <Icon aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </section>
      ))}
    </nav>
  );
}

export default function AdminShell() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = NAV_GROUPS.flatMap((group) => group.items).find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to));
  useEffect(() => {
    applyPageMetadata(location.pathname);
  }, [location.pathname]);

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar">
        <Link to="/admin" className="ops-brand">
          <span className="ops-brand-mark">AD</span>
          <span><strong>行政管理中心</strong><small>ADHD 家長支持平台</small></span>
        </Link>
        <Navigation />
        <div className="ops-sidebar-footer">
          <div className="ops-user" title={user?.email}>{user?.displayName || user?.email || '開發預覽模式'}</div>
          <div className="ops-user-actions"><button className="ops-link-button" onClick={() => void signOut()}>登出</button><Link className="ops-link-button" to="/">回公開網站</Link></div>
        </div>
      </aside>
      <header className="ops-mobile-header">
        <button className="ops-mobile-menu" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? '關閉選單' : '開啟選單'} aria-expanded={menuOpen}>
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <strong>{current?.label ?? '行政管理中心'}</strong>
        <Link to="/" className="ops-link-button">前台</Link>
      </header>
      {menuOpen ? <><div className="ops-mobile-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" /><aside className="ops-mobile-drawer"><Navigation onNavigate={() => setMenuOpen(false)} /></aside></> : null}
      <main className="ops-main"><div className="ops-content"><Outlet /></div></main>
    </div>
  );
}

