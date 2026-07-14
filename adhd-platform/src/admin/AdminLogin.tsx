/**
 * 後台登入頁。【CLAUDE / K3】
 * Google OAuth 整頁導向；已登入者自動進 /admin。
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { isSupabaseReady } from '@/lib/supabase';

export default function AdminLogin() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (user) {
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from ?? '/admin', { replace: true });
    }
  }, [user, navigate, location.state]);

  const handleSignIn = async () => {
    setError(undefined);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗，請稍後再試。');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream bg-dots p-4">
      <div className="warm-card w-full max-w-sm p-8 text-center">
        <h1 className="mb-2 text-xl font-bold">行政後台登入</h1>
        <p className="mb-6 text-sm text-brown/70">使用 Google 帳號登入以進入管理系統。</p>
        <button
          className="btn-warm w-full justify-center"
          onClick={() => void handleSignIn()}
          disabled={loading}
        >
          以 Google 登入
        </button>
        {!isSupabaseReady ? (
          <p className="mt-4 text-xs text-brown/50">（尚未設定 Supabase 環境變數，登入不可用）</p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-4 rounded-lg border border-alert-red bg-alert-red/10 px-3 py-2 text-xs">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
