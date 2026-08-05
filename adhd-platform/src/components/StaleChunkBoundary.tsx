/**
 * 攔住「舊分頁載入不到新版 chunk」造成的白畫面（見 lib/staleChunk.ts）。
 *
 * 第一次自動重新載入；重載後仍然失敗才顯示這張卡片，並附一顆一鍵重新載入。
 * 不是版本問題的錯誤照樣往上拋，交給原本的錯誤處理——這個界線要守住，
 * 否則所有的錯誤都會被寫成「請重新載入」，真正的問題就被蓋掉了。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isStaleChunkError, recoverFromStaleChunk } from '@/lib/staleChunk';

interface Props { children: ReactNode }
interface State { stale: boolean }

export class StaleChunkBoundary extends Component<Props, State> {
  state: State = { stale: false };

  static getDerivedStateFromError(error: unknown): State | null {
    return isStaleChunkError(error) ? { stale: true } : null;
  }

  componentDidCatch(error: unknown, _info: ErrorInfo) {
    if (!isStaleChunkError(error)) throw error;
    recoverFromStaleChunk();
  }

  render() {
    if (!this.state.stale) return this.props.children;
    return (
      <div className="min-h-[50vh] grid place-items-center px-4 py-12">
        <div className="max-w-md w-full bg-white border-2 border-brown rounded-2xl p-6 text-center shadow-warm">
          <h2 className="font-heading text-xl font-black text-brown mb-2">版本已更新</h2>
          <p className="text-sm leading-relaxed text-brown/80">
            這個分頁開著的期間網站更新過了，所以剛才那一段載入不到。重新載入就會恢復，
            你正在看的資料不會有事。
          </p>
          <button
            type="button"
            className="btn-warm mt-6 px-6 py-3 bg-base-yellow text-brown font-black border-2 border-brown shadow-warm"
            onClick={() => window.location.reload()}
          >
            重新載入
          </button>
        </div>
      </div>
    );
  }
}
