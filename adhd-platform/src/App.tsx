/**
 * 應用根元件。【CLAUDE】
 * 掛上全域 Provider（Auth）與路由。
 */
import { AuthProvider } from '@/lib/auth';
import AppRouter from '@/router';

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
