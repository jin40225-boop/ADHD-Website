/**
 * 導航計畫的「開放預約時段」摘要。
 *
 * 這一區原本是三行寫死的規則文字（「第二週 週一 20:00-21:00」…）。規則本身沒錯，但它
 * 不會過期也不會跟著後台調整——場次詳情改了候選時段，這裡照樣顯示舊規則。改讀該月場次的
 * `slot_options`，顯示的就是報名表單上真正會出現的那幾個確切時段。
 */
import { useEffect, useState } from 'react';
import { getUpcomingSessions, getProjectBySlug } from '@/lib/api';
import type { SessionSlot } from '@contracts/types';

const WEEKDAY = '日一二三四五六';
function slotLabel(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAY[d.getDay()]}）${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NavigatorSlotSummary() {
  const [session, setSession] = useState<SessionSlot>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const project = await getProjectBySlug('navigator');
        if (!project) { if (alive) setFailed(true); return; }
        const sessions = await getUpcomingSessions(project.id);
        // 最近一個還有候選時段的月份就是「現在開放預約的那個月」。
        const next = sessions.find((item) => item.slotOptions?.length);
        if (alive) { setSession(next); setFailed(!next); }
      } catch { if (alive) setFailed(true); }
    })();
    return () => { alive = false; };
  }, []);

  const month = session ? `${new Date(session.startsAt).getMonth() + 1} 月` : '';
  return (
    <div className="bg-[#FFF9C4] border-l-8 border-accent-orange p-6 rounded-r-2xl">
      <h4 className="font-bold text-brown text-xl mb-3 flex items-center gap-2">🕐 開放預約時段</h4>
      <p className="text-sm font-bold text-brown mb-2">每月僅開放 1 位專屬名額，請彈性勾選（可複選）：</p>
      {session?.slotOptions?.length ? (
        <>
          <ul className="text-brown space-y-1 font-bold list-disc list-inside text-sm">
            {session.slotOptions.map((option) => (
              <li key={option.startsAt}>
                {slotLabel(option.startsAt)}–{slotLabel(option.endsAt).split('）')[1]}
                {option.note ? <span className="font-normal text-xs">（{option.note}）</span> : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-brown mt-2">（以上為 {month} 的確切日期，直接來自報名表單，不是另外抄一份。）</p>
        </>
      ) : (
        // 讀不到就說讀不到，不要退回一份會過期的寫死清單。
        <p className="text-sm text-brown">
          {failed ? '目前沒有開放中的月份，或時段尚未排定。' : '載入中…'}
          <span className="block text-xs mt-1">確切日期一律以報名表單上列出的為準。</span>
        </p>
      )}
    </div>
  );
}
