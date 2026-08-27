/**
 * 行動版摺疊、桌機恆展開的區塊包裝。【WP9 首頁收攏】
 *
 * 立法理由：手機版首頁量到 17,207px（375px 寬），主因是「115年計畫」區把每條服務的
 * 完整介紹又貼了一次，而那些內容各自的服務專頁本來就有。收攏的原則是**摘要常駐、
 * 完整介紹收起來**，一個字都不刪。
 *
 * 為什麼用 matchMedia 而不是純 CSS 隱藏：桌機一旦只是把摘要 `display:none`，摘要裡的
 * UpcomingSessions／RegisterCta 仍然會掛載並各自打一輪 Supabase——桌機首頁會平白多出
 * 十幾個沒人看得到的查詢。改成桌機直接 `return <>{children}</>`，DOM 與改版前逐一相同
 * （連 flex gap 都沒動過），也不會有多餘請求。
 *
 * 動畫用 grid-template-rows 0fr↔1fr（與 UpcomingSessions 的摺疊同一套），
 * `prefers-reduced-motion: reduce` 時由 tokens.css 關掉 transition，功能照常。
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

const MOBILE_QUERY = '(max-width: 767px)';

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);
  return isMobile;
}

export interface CollapsibleSectionProps {
  /** 摺疊時仍常駐的摘要：標題、一句話、報名鈕、前往專頁。
   *  區塊本身已經有常駐標題時（例如「籌備中與即將推出」那條分隔線）留空即可，
   *  展開鈕的文字就是它的標題——摘要放在這裡反而會在桌機整個消失。 */
  summary?: ReactNode;
  /** 展開鈕文字（收合狀態）。 */
  label: string;
  /** 展開鈕文字（展開狀態）。 */
  collapseLabel: string;
  /** 桌機是否恆展開。首頁服務卡為 true；重複五次的自我介紹為 false（各寬度都收起）。 */
  expandedOnDesktop?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  summary,
  label,
  collapseLabel,
  expandedOnDesktop = true,
  children,
}: CollapsibleSectionProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // 桌機恆展開時，連包裝都不生成：版面與改版前完全相同。
  if (expandedOnDesktop && !isMobile) return <>{children}</>;

  return (
    <>
      {summary ? <div className="collapsible-summary">{summary}</div> : null}
      <button
        type="button"
        className="btn-warm w-full my-4 py-3 px-4 bg-white text-brown text-base font-black justify-center border-2 border-brown shadow-warm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? collapseLabel : label}
        <ChevronDown
          className={`w-5 h-5 ml-2 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div id={panelId} className={`collapsible-body${open ? ' open' : ''}`}>
        <div className="collapsible-body-inner">
          <div className="collapsible-body-stack">{children}</div>
        </div>
      </div>
    </>
  );
}
