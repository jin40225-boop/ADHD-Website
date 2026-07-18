/**
 * 場次摺疊卡互動。【CLAUDE 整合 INTEGRATED-FIX 2026-07-18】
 * 舊一頁式的 toggleSession() 在 HTML→JSX 遷移時遺失（session-header 無 onClick），
 * 卡片內容全數攤開。此 hook 以事件委派還原：點 .session-header 切換相鄰
 * .session-content 的 .open，並旋轉標頭內的 chevron 圖示。
 * 事件掛在頁面容器 ref 上，避免全域監聽誤傷其他頁。
 */
import { useEffect, useRef } from 'react';

export function useSessionCardToggle<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onClick = (e: MouseEvent) => {
      const header = (e.target as HTMLElement).closest('.session-header');
      if (!header || !container.contains(header)) return;
      // 標頭內的連結／按鈕照常運作，不觸發摺疊
      if ((e.target as HTMLElement).closest('a, button')) return;
      const content = header.nextElementSibling as HTMLElement | null;
      if (!content || !content.classList.contains('session-content')) return;
      // 以 inline max-height 驅動展開（scrollHeight 取實高，內容超過舊站 1000px 上限也不截斷）
      const opening = !content.classList.contains('open');
      content.classList.toggle('open', opening);
      content.style.maxHeight = opening ? `${content.scrollHeight}px` : '0px';
      const icon = header.querySelector('svg');
      if (icon) {
        (icon as SVGElement).style.transform = opening ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    };

    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, []);

  return containerRef;
}
