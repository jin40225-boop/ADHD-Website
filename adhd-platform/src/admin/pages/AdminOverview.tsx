/**
 * 後台總覽。【CLAUDE 整合層】
 * 各功能模組入口與目前串接狀態一覽。
 */
import { Link } from 'react-router-dom';
import { SectionTitle, WarmCard } from '@/components/ui';
import { isSupabaseReady } from '@/lib/supabase';
import DemoDataNotice from '../DemoDataNotice';

const MODULES = [
  { to: '/admin/registrations', title: '報名審核工作台', desc: '真實資料：報名、狀態流、信件串與範本寄送。' },
  { to: '/admin/sessions', title: '場次管理', desc: '真實資料：場次、名額與 Meet 行事曆。' },
  { to: '/admin/forms', title: '報名表編輯', desc: '真實資料：各專案欄位與選項設定。' },
  { to: '/admin/recommendations', title: '推薦資料庫審核', desc: '真實資料：投稿比對、核實、上架與前台同步。' },
  { to: '/admin/feedback', title: '活動回饋', desc: '真實資料：公開回饋單送出的留言。' },
  { to: '/admin/instructors', title: '講師邀約', desc: '示意模式：候選時段與講師回覆矩陣。' },
  { to: '/admin/templates', title: '信件範本管理', desc: '真實資料：範本 CRUD 與變數預覽。' },
  { to: '/admin/cases', title: '個案管理', desc: '受保護資料：個案與服務紀錄。' },
];

export default function AdminOverview() {
  return (
    <div>
      <SectionTitle size="lg">後台總覽</SectionTitle>
      <div className="mt-4">
        {isSupabaseReady ? (
          <div className="mb-4 rounded-xl border-2 border-brown/40 bg-accent-teal/20 px-4 py-2.5 text-sm">
            <strong>系統狀態：</strong>
            資料庫、Google 登入、歷史資料遷移、報名審核、場次、表單、推薦、信件範本、個案與活動回饋已上線。
            Gmail／Meet 已完成程式接線；講師邀約目前仍為示意模式。
          </div>
        ) : (
          <DemoDataNotice note="Supabase 環境變數未設定，全部模組為示意資料。" />
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((module) => (
          <Link key={module.to} to={module.to} className="block">
            <WarmCard hoverable style={{ padding: '1.25rem', height: '100%' }}>
              <strong className="font-heading text-lg">{module.title}</strong>
              <p className="mt-1 text-sm text-brown/80">{module.desc}</p>
            </WarmCard>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-xs text-brown/60">
        開發者工具：<Link to="/admin/gallery" className="underline">品牌元件庫展示頁（UiGallery）</Link>
      </p>
    </div>
  );
}
