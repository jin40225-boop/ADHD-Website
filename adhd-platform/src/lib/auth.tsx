/**
 * 認證情境。【CLAUDE / K3】
 * Google OAuth（Supabase Auth）＋ profiles 載入。
 * 未設定 Supabase 環境變數時退回骨架行為（user=null、signIn 警告），前台不受影響。
 * 登入後 profile 由資料庫觸發器 adhd_handle_new_user 自動建立。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Profile } from '@contracts/types';
import { supabase } from './supabase';

export interface AuthState {
  user: Profile | null;
  loading: boolean;
  /** Google OAuth 登入（整頁導向，回跳 /admin）。 */
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: false,
  signIn: async () => console.warn('[auth] Supabase 未設定，無法登入'),
  signOut: async () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    const loadProfile = async (userId?: string) => {
      if (!userId) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      const { data, error } = await supabase!
        .from('profiles')
        .select('id, email, display_name, avatar_url, is_system_owner, created_at')
        .eq('id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.error('[auth] 載入 profile 失敗：', error.message);
      setUser(
        data
          ? {
              id: data.id,
              email: data.email,
              displayName: data.display_name,
              avatarUrl: data.avatar_url ?? undefined,
              isSystemOwner: data.is_system_owner,
              createdAt: data.created_at,
            }
          : null,
      );
      setLoading(false);
    };

    void supabase.auth.getSession().then(({ data }) => loadProfile(data.session?.user.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadProfile(session?.user.id);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async () => {
    if (!supabase) {
      console.warn('[auth] Supabase 未設定，無法登入');
      return;
    }
    // 回跳網址須列於 Supabase Auth → URL Configuration 的 Redirect URLs
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}admin`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/** 取得目前登入狀態。 */
export function useAuth(): AuthState {
  return useContext(AuthContext);
}
