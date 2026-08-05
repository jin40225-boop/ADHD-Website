/**
 * 部署後仍開著的分頁會安靜壞掉。
 *
 * Vite 的 chunk 檔名帶 hash，新部署一上去舊檔就不存在了。這時舊分頁裡的 lazy import 會 404，
 * 畫面變空白或按鈕按了沒反應，而且**沒有任何訊息**告訴人發生了什麼。這個站一天部署好幾次，
 * 而後台是會被開著好幾天的那種頁面——監督視窗就因此把它誤判成「同步函式壞了」，查了一輪
 * 才發現是分頁太舊。
 *
 * 對策：偵測到這種載入失敗就自動重新載入**一次**，重來一次還是失敗才顯示訊息讓人自己決定。
 * 「只自動一次」是重點：如果失敗的原因不是版本過期（例如網路斷了），無限自動重載只會更糟。
 */
const RELOAD_FLAG = 'adhd-stale-chunk-reloaded';

/** 動態載入失敗的錯誤訊息在各家瀏覽器長得不一樣，共通點是都在講「模組載入失敗」。 */
export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \d+ failed/i.test(message);
}

/**
 * 自動重新載入一次。回傳 true 代表已經要重載了，呼叫端不必再顯示什麼。
 * 回傳 false 代表這一輪已經重載過，問題不是版本過期，該把畫面交還給使用者。
 */
export function recoverFromStaleChunk(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false;
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    // 無痕模式等情況下 sessionStorage 會擲錯。寧可不自動重載，也不要冒無限迴圈的風險。
    return false;
  }
  window.location.reload();
  return true;
}

/** 成功載入之後把旗標清掉，下一次部署才有機會再自動救一次。 */
export function clearStaleChunkFlag() {
  try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* 沒有 sessionStorage 就算了 */ }
}

/**
 * Vite 在動態載入的 preload 失敗時會在 window 上發 `vite:preloadError`。
 * 它比 ErrorBoundary 早一步，接得到「還沒渲染就失敗」的情況。
 */
export function watchForStaleChunks() {
  window.addEventListener('vite:preloadError', () => { recoverFromStaleChunk(); });
}
