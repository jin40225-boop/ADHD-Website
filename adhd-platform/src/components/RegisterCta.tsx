/**
 * 頁底那顆大報名鈕。【WP8 誠實 CTA】
 *
 * 原本四頁各自寫死一個 `<a>`：不論名額狀況都喊「前往填寫報名表」。八月職場諮詢三個
 * 時段全部額滿時，同一頁上方的 UpcomingSessions 已經逐列標出「已額滿」，頁底卻還在
 * 招手——這是結構問題（靜態連結不知道資料），不是文案寫錯，所以改成讀同一份資料。
 *
 * 判斷邏輯**照抄 UpcomingSessions**（`notYetOpen ? … : isFull ? …` 那組三態），不另外
 * 發明規則；兩邊講的必須是同一件事。
 *
 * 最重要的一條：**絕不因技術問題擋住報名**。載入中、查詢失敗、Supabase 未設定（demo
 * 模式）、甚至查得到但沒有任何場次——一律退回現行的靜態按鈕（原樣文案、可點）。寧可
 * 顯示過時文案，也不能讓想報名的人點不到。額滿時按鈕也仍然可點（候補／看新場次）。
 */
import { useEffect, useState } from 'react';
import { seatAvailability } from '@/lib/seatAvailability';
import { getProjectBySlug, getUpcomingSessions } from '@/lib/api';

const BASE = import.meta.env.BASE_URL;

export type RegisterCtaSlug = 'career' | 'parent' | 'peer-group' | 'navigator';

/**
 * 各頁現行文案逐字保留：有任一場開放時，顯示結果必須與改版前完全相同。
 *
 * 額滿時有兩種說法，而且**不是依服務線決定，是依那些場次自己的設定決定**：
 *   waitlistLabel —— 額滿的場次裡，至少有一場 `allowWaitlist`＝仍收候補。
 *   fullLabel     —— 全部都不收了。
 *
 * ⚠ 這一條是使用者 2026-08-27 親自叮嚀的「記得確認一致性」：
 *   後端 `enforce_session_capacity` 現在是逐場看 `allow_waitlist` 決定收不收，
 *   前台這句話就必須讀同一個欄位。寫死成「職場一律可候補」會在他把某一場的
 *   候補關掉時變成謊話——按鈕邀請你送出，後端回 SESSION_FULL_OR_CLOSED。
 */
const COPY: Record<RegisterCtaSlug, { label: string; note: string; fullLabel: string; waitlistLabel: string }> = {
  career: { label: '📝 前往填寫報名表', note: '報名連結',
    fullLabel: '本期時段已滿・新場次公布後開放', waitlistLabel: '目前時段已滿・仍可送出候補申請' },
  parent: { label: '📝 前往填寫報名表', note: '報名連結',
    fullLabel: '本月已額滿・新場次公布後開放', waitlistLabel: '本月已額滿・仍可送出候補報名' },
  'peer-group': { label: '📝 立即填寫報名表', note: '預先報名讓我們更好準備喔！',
    fullLabel: '本月已額滿・新場次公布後開放', waitlistLabel: '本月已額滿・仍可送出候補報名' },
  navigator: { label: '📝 前往填寫報名表', note: '重要報名連結',
    fullLabel: '本月已額滿・新場次公布後開放', waitlistLabel: '本月已額滿・仍可送出候補申請' },
};

export interface RegisterCtaProps {
  slug: RegisterCtaSlug;
}

export function RegisterCta({ slug }: RegisterCtaProps) {
  // 只有明確查到「有場次、且沒有任何一場可報」才轉成額滿文案；其餘一律靜態按鈕。
  const [isFull, setIsFull] = useState(false);
  // 額滿的那些場次裡，還有沒有人收候補。決定要說哪一種額滿。
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const project = await getProjectBySlug(slug);
        if (!project) throw new Error('project not found');
        // 不帶 includeUnpublished：未上架場次不影響「現在能不能報名」。
        const sessions = await getUpcomingSessions(project.id);
        if (!alive) return;
        // 收不收得到，一律問 seatAvailability——報名頁的選項用的是同一支，
        // 兩邊不可能再說出互相矛盾的話（2026-08-28 就是這樣分岔過一次）。
        const availability = sessions.map((session) => seatAvailability(session, project.seatPolicy));
        const bookable = availability.some((a) => a.accepted && !a.viaWaitlist);
        const waitlisting = availability.some((a) => a.accepted && a.viaWaitlist);
        setIsFull(sessions.length > 0 && !bookable);
        setWaitlistOpen(waitlisting);
      } catch {
        // 查不到就當作沒事發生：維持靜態按鈕，報名路徑永遠不被技術問題擋住。
        if (alive) { setIsFull(false); setWaitlistOpen(false); }
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const copy = COPY[slug];
  return (
    <a
      className={`btn-warm py-5 px-6 bg-base-yellow text-brown w-full text-2xl md:text-3xl shadow-warm${isFull ? '' : ' animate-pulse-slow'} flex flex-col items-center justify-center border-4 border-brown`}
      href={`${BASE}${slug}/register`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span>{isFull ? (waitlistOpen ? copy.waitlistLabel : copy.fullLabel) : copy.label}</span>
      <span className="text-base font-bold mt-2 opacity-80 bg-white/40 px-3 py-1 rounded-full border border-brown/20">{copy.note}</span>
    </a>
  );
}
