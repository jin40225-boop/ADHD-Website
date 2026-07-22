import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { isSupabaseReady, supabase } from '@/lib/supabase';

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const devBypass = import.meta.env.DEV && (!isSupabaseReady || import.meta.env.VITE_DEV_AUTH_BYPASS === 'true');
  const [allowed, setAllowed] = useState<boolean | null>(devBypass ? true : user?.isSystemOwner ? true : null);
  useEffect(() => {
    if (devBypass || user?.isSystemOwner) { setAllowed(true); return; }
    if (!user || !supabase) { setAllowed(false); return; }
    supabase.from('project_members').select('id').eq('user_id', user.id).in('role', ['owner', 'admin_collab']).limit(1).then(({ data, error }) => setAllowed(!error && Boolean(data?.length)));
  }, [devBypass, user]);
  if (allowed === null) return <div className="p-10 text-center text-brown/60">驗證後台權限中…</div>;
  if (!allowed) return <div className="mx-auto max-w-xl p-10 text-center"><h1 className="text-2xl font-bold">沒有行政後台權限</h1><p className="my-4">此帳號已登入，但尚未被指派為系統擁有者、行政協作者或完整講師。</p><Link className="underline" to="/">返回公開網站</Link></div>;
  return <>{children}</>;
}

