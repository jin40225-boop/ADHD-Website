/**
 * 後台路由守衛。【CLAUDE / K3】
 * 未登入導向 /admin/login。
 * 開發旁路縮限為顯式開關：DEV 且（未設 Supabase 或 VITE_DEV_AUTH_BYPASS=true）。
 * Google OAuth 供應商設定完成後，將 .env 的 VITE_DEV_AUTH_BYPASS 移除即走真登入。
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { isSupabaseReady } from '@/lib/supabase';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  const devBypass =
    import.meta.env.DEV &&
    (!isSupabaseReady || import.meta.env.VITE_DEV_AUTH_BYPASS === 'true');

  if (loading && !devBypass) {
    return <div className="p-10 text-center text-brown/60">載入中…</div>;
  }

  if (!user && !devBypass) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
