/**
 * 協辦活動綜合專欄：一個合作案一張卡。
 *
 * **為什麼不沿用 `UpcomingSessions`**：那支以「年-月」聚合（groupByMonth），卡片標題
 * 取該月第一筆場次的 title。協辦活動是多個主辦單位並存的專欄——2026 年 9 月同時有
 * 父親權益協會 9/15 與赤子心 9/19，沿用會把兩個不同單位的活動壓成同一張「9月場」卡、
 * 標題只剩其中一個。這裡改以 `activity_id` 分組，是專欄的正確聚合單位。
 *
 * **這支刻意沒有名額的概念**。報名完全在主辦單位，我方的 `booked_count` 永遠是 0，
 * 顯示「剩 N 名」就是假資料。容量填 0 也不是權宜之計，而是安全控制：
 * `enforce_session_capacity` 在 `0 < 0` 不成立時直接拒絕整筆報名，就算有人繞過前端
 * 直接打報名 API，資料庫也會擋掉——「協辦活動不會有報名者個資」是靠那個 0 兌現的。
 * 所以這裡不算 remaining、不算 isFull，沒有的程式碼不會出錯。
 *
 * 所有對外連結與文案都來自資料庫（`activities_public.cohost_info` / `public_summary`），
 * 不寫死在這裡：既因為 `scripts/check-site.mjs` 禁止 `forms.gle` 出現在公開頁原始碼，
 * 也因為新增第三、第四個合作案時不該要改程式。
 */
import { useEffect, useState } from 'react';
import { Calendar, CalendarClock, ChevronDown, ExternalLink, Handshake } from 'lucide-react';
import { getProjectBySlug, getPublicActivities, getUpcomingSessions } from '@/lib/api';
import type { PublicActivity, SessionSlot } from '@contracts/types';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function fmtDateTime(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${s.getMonth() + 1}月 ${s.getDate()}日 (${WEEKDAYS[s.getDay()]}) ${pad(s.getHours())}:${pad(s.getMinutes())} – ${pad(e.getHours())}:${pad(e.getMinutes())}`;
}

/**
 * 只放行 http/https。
 *
 * 這是「後台自由輸入 → 匿名前台 render 成 <a href>」的欄位：不做白名單，後台帳號
 * 被盜或誤貼 `javascript:` 就是一個 XSS 面。擋掉之後回傳 undefined，呼叫端不渲染按鈕。
 */
function safeUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  return /^https?:\/\//i.test(value) ? value : undefined;
}

export function CoHostActivities({ projectSlug = 'co-host' }: { projectSlug?: string }) {
  const [activities, setActivities] = useState<PublicActivity[] | null>(null);
  const [sessions, setSessions] = useState<SessionSlot[]>([]);
  const [failed, setFailed] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const project = await getProjectBySlug(projectSlug);
        if (!project) throw new Error('project not found');
        // 一併帶未上架場次：協辦活動的日期由對方決定，我們常常是先知道有這場、
        // 細節還沒公布，這時場次以 closed 存著，前台仍應該讓人看到「有這場」。
        const [nextActivities, nextSessions] = await Promise.all([
          getPublicActivities(project.id),
          getUpcomingSessions(project.id, { includeUnpublished: true }),
        ]);
        if (alive) {
          setActivities(nextActivities);
          setSessions(nextSessions);
        }
      } catch {
        if (alive) {
          setFailed(true);
          setActivities([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectSlug]);

  if (activities === null) {
    return (
      <div className="session-card">
        <div className="p-6 text-gray-500 font-bold flex items-center gap-2">
          <CalendarClock className="w-5 h-5" /> 合作活動載入中…
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="session-card">
        <div className="p-6 space-y-2">
          <p className="font-bold text-brown flex items-center gap-2">
            <Handshake className="w-5 h-5" />
            目前沒有進行中的合作活動
          </p>
          <p className="text-gray-600 text-sm leading-relaxed">
            {failed
              ? '活動資訊暫時無法載入，歡迎加入官方 LINE 接收最新消息。'
              : '有新的合作場次時會直接出現在這裡，也歡迎加入官方 LINE 搶先接收通知！'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {activities.map((activity, index) => {
        const own = sessions.filter((s) => s.activityId === activity.id);
        const coHost = activity.coHost;
        const formUrl = safeUrl(coHost?.formUrl);
        const infoUrl = safeUrl(coHost?.infoUrl);
        const isOpen = collapsed[activity.id] ?? true;
        const panelId = `cohost-panel-${activity.id}`;

        return (
          <article
            className="bg-white border-2 border-brown rounded-3xl p-6 md:p-10 relative shadow-[8px_8px_0_rgba(93,64,55,0.15)] flex flex-col gap-6"
            key={activity.id}
          >
            <header className="space-y-4 text-brown">
              <div className="flex flex-wrap gap-2">
                <span className="session-tag bg-accent-teal text-brown">合作活動 {index + 1}</span>
                {activity.status !== 'published' ? (
                  <span className="session-tag bg-gray-200 text-gray-600">已結束</span>
                ) : null}
              </div>
              <h2 className="font-heading text-2xl md:text-3xl font-black leading-tight">{activity.name}</h2>
              <div className="flex flex-wrap gap-2">
                {coHost?.partner ? (
                  <span className="inline-block bg-white border-2 border-brown px-4 py-2 rounded-full text-sm font-bold shadow-warm">
                    主辦單位｜{coHost.partner}
                  </span>
                ) : null}
                {coHost?.myRole ? (
                  <span className="inline-block bg-accent-teal border-2 border-brown px-4 py-2 rounded-full text-sm font-bold shadow-warm">
                    我的角色｜{coHost.myRole}
                  </span>
                ) : null}
              </div>
              {activity.publicSummary ? (
                <p className="leading-relaxed text-lg font-medium text-justify whitespace-pre-line">
                  {activity.publicSummary}
                </p>
              ) : null}
            </header>

            {coHost?.partner ? (
              <div className="bg-[#FFF9C4] border-l-8 border-accent-orange p-5 rounded-r-2xl">
                <p className="font-bold text-brown text-lg">🙏 感謝 {coHost.partner} 支持</p>
              </div>
            ) : null}

            {own.length ? (
              <div className="border-t-4 border-dashed border-brown/20 pt-6">
                <button
                  type="button"
                  className="session-header"
                  style={{ padding: 0 }}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setCollapsed((c) => ({ ...c, [activity.id]: !isOpen }))}
                >
                  <span className="font-bold text-brown text-xl">
                    場次{own.length > 1 ? `（共 ${own.length} 場）` : ''}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                <ul id={panelId} className={isOpen ? 'mt-4 space-y-3' : 'hidden'}>
                  {own.map((s) => (
                    <li className="bg-cream border-2 border-brown/20 rounded-2xl p-4 space-y-2" key={s.id}>
                      <p className="font-bold text-brown text-lg">{s.title}</p>
                      <span className="flex items-center gap-1 text-sm font-bold text-gray-600">
                        <Calendar className="w-4 h-4" /> {fmtDateTime(s.startsAt, s.endsAt)}
                      </span>
                      {s.guest ? <p className="text-brown font-bold text-sm">講師：{s.guest}</p> : null}
                      {s.description ? (
                        <p className="text-gray-700 leading-relaxed text-justify whitespace-pre-line text-sm">
                          {s.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {coHost?.note ? (
              <div>
                <h3 className="font-bold text-brown mb-2 border-l-4 border-accent-orange pl-2">
                  主辦單位的報名資訊：
                </h3>
                <p className="text-gray-700 leading-relaxed text-justify whitespace-pre-line">{coHost.note}</p>
              </div>
            ) : null}

            {formUrl ? (
              <a
                className="btn-warm py-5 px-6 bg-accent-teal text-brown w-full text-xl md:text-2xl shadow-warm flex flex-col items-center justify-center border-4 border-brown"
                href={formUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>📝 前往主辦單位報名表單</span>
                <span className="text-sm font-bold mt-2 opacity-80 bg-white/40 px-3 py-1 rounded-full border border-brown/20">
                  外部連結・報名由主辦單位受理
                </span>
              </a>
            ) : (
              // 沒有連結就明說，不放一顆按不動的按鈕假裝可以報名。
              <p className="text-sm font-bold text-gray-600 bg-cream border-2 border-brown/20 rounded-2xl p-4">
                主辦單位尚未公布報名連結。報名方式請以主辦單位的公告為準。
              </p>
            )}

            {infoUrl ? (
              <a
                className="btn-warm py-4 px-6 bg-white text-brown w-full text-base font-bold shadow-warm flex items-center justify-center border-2 border-brown"
                href={infoUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4" /> 查看主辦單位的活動介紹頁
              </a>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
