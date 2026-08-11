/**
 * 動態「即將舉行場次」區塊。【CLAUDE 整合 2026-07-19】
 * 取代首頁/互助聚會頁手寫的即將場次卡：改讀 Supabase（getUpcomingSessions，
 * 走 sessions_public view），後台開新場次即自動出現、過期自動消失，
 * 不再需要手動維護兩份靜態活動卡。歷史場次卡仍為手寫策展內容。
 *
 * 摺疊互動（2026-08-10 裁決：舊版既定格式，除非明確要求拿掉否則永遠保留）：
 * React state ＋ CSS Grid rows（見 tokens.css 的 .session-header/.session-content），
 * 不用舊版的命令式 DOM hook——月聚合後每次 re-render 會把 inline style 洗掉，
 * grid-template-rows: 0fr↔1fr 天生無截斷、資料更新自動跟隨。
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CalendarClock, ChevronDown, Clock, Users } from 'lucide-react';
import { getProjectBySlug, getUpcomingSessions } from '@/lib/api';
import type { SessionSlot } from '@contracts/types';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月 ${d.getDate()}日 (${WEEKDAYS[d.getDay()]})`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isSameDay(a: string, b: string): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/**
 * 一列時段的時間文字。`withDate` 是「這一組場次不在同一天，所以每列要自己標日期」。
 *
 * 跨日的那一場另外處理：`endsAt` 與 `startsAt` 不同天時一定要印出結束日期，
 * 否則會變成「20:00 – 10:00」這種看起來像壞掉的值——而且此時就算整組同一天，
 * 開始日期也得補上，不然讀者只看到一個孤零零的結束日期不知道從哪天算起。
 */
export function fmtSlotRange(startsAt: string, endsAt: string, withDate: boolean): string {
  if (!isSameDay(startsAt, endsAt)) {
    return `${fmtDate(startsAt)} ${fmtTime(startsAt)} – ${fmtDate(endsAt)} ${fmtTime(endsAt)}`;
  }
  return withDate
    ? `${fmtDate(startsAt)} ${fmtTime(startsAt)} – ${fmtTime(endsAt)}`
    : `${fmtTime(startsAt)} – ${fmtTime(endsAt)}`;
}

/** 只剝「【N月場】」這個精確型式，避免誤傷其他【】標題。 */
function stripMonthTag(title: string): string {
  return title.replace(/^【\d+月場】\s*/, '');
}

/** 以 startsAt 的西元年-月分組，一組收斂為一張月卡。
 *  API 已依 starts_at 升冪排序，用 Map 保留插入順序即可，組間順序自動正確。 */
function groupByMonth(sessions: SessionSlot[]): { key: string; sessions: SessionSlot[] }[] {
  const map = new Map<string, SessionSlot[]>();
  for (const s of sessions) {
    const d = new Date(s.startsAt);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const group = map.get(key);
    if (group) group.push(s);
    else map.set(key, [s]);
  }
  return [...map.entries()].map(([key, groupSessions]) => ({ key, sessions: groupSessions }));
}

export interface UpcomingSessionsProps {
  /** 專案 slug（預設互助聚會） */
  projectSlug?: string;
  /** 報名頁站內路徑（交給 react-router，勿含 BASE 前綴） */
  registerPath?: string;
  /** 一併列出尚未上架的場次，標示「即將開放」且不可報名。 */
  includeUnpublished?: boolean;
  /** 顯示「主題／客座嘉賓」列；未公布時顯示「神秘驚喜！」。 */
  showTopic?: boolean;
}

export function UpcomingSessions({
  projectSlug = 'peer-group',
  registerPath = '/peer-group/register',
  includeUnpublished = false,
  showTopic = false,
}: UpcomingSessionsProps) {
  const [sessions, setSessions] = useState<SessionSlot[] | null>(null);
  const [failed, setFailed] = useState(false);
  // 覆寫表＋預設值（第一張卡預設展開）而非初始化 Set，避免 sessions 非同步載入的時序問題。
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const project = await getProjectBySlug(projectSlug);
        if (!project) throw new Error('project not found');
        const list = await getUpcomingSessions(project.id, { includeUnpublished });
        if (alive) setSessions(list);
      } catch {
        if (alive) {
          setFailed(true);
          setSessions([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectSlug]);

  if (sessions === null) {
    return (
      <div className="session-card">
        <div className="p-6 text-gray-500 font-bold flex items-center gap-2">
          <CalendarClock className="w-5 h-5" /> 場次載入中…
        </div>
      </div>
    );
  }

  // 未公布主題／來賓時，依裁決 3 顯示「神秘驚喜！」而非留白。
  const mystery = (value?: string) =>
    value ? <>{value}</> : <span className="font-black text-highlight">神秘驚喜！</span>;

  if (sessions.length === 0) {
    return (
      <div className="session-card">
        <div className="p-6 space-y-2">
          <p className="font-bold text-brown flex items-center gap-2">
            <CalendarClock className="w-5 h-5" />
            下一場次籌備中！
          </p>
          <p className="text-gray-600 text-sm leading-relaxed">
            {failed
              ? '場次資訊暫時無法載入，歡迎加入官方 LINE 接收最新活動通知。'
              : '新場次公布後會直接出現在這裡，也歡迎加入官方 LINE 搶先接收通知！'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {groupByMonth(sessions).map((group, index) => {
        const first = group.sessions[0];
        const month = new Date(first.startsAt).getMonth() + 1;
        const title = stripMonthTag(first.title);
        // 標題列狀態 tag：整組全 closed →「即將開放」；整組全額滿 →「已額滿」；否則不加。
        const allClosed = group.sessions.every((s) => s.status === 'closed');
        const allFull = group.sessions.every((s) => s.status === 'full' || s.capacity - s.bookedCount <= 0);
        const isOpen = toggled[group.key] ?? (index === 0);
        const panelId = `session-panel-${group.key}`;

        const header = (
          <button
            type="button"
            className="session-header"
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={() => setToggled((t) => ({ ...t, [group.key]: !isOpen }))}
          >
            <span className="flex items-center gap-3 flex-wrap">
              <span className="session-tag bg-accent-orange text-brown">{month}月場</span>
              {allClosed ? (
                <span className="session-tag bg-gray-200 text-gray-600">即將開放</span>
              ) : allFull ? (
                <span className="session-tag bg-gray-200 text-gray-600">已額滿</span>
              ) : null}
              <span className="font-bold text-brown text-lg">
                {title}
                {showTopic ? (
                  first.topic ? (
                    <>：{first.topic}</>
                  ) : (
                    <span className="text-sm font-bold ml-2">主題：{mystery(undefined)}</span>
                  )
                ) : null}
              </span>
            </span>
            <ChevronDown
              className={`w-5 h-5 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        );

        const descriptionBlock = first.description ? (
          <div>
            <h4 className="font-bold text-brown mb-2 border-l-4 border-accent-orange pl-2">我們聊什麼：</h4>
            <p className="text-gray-700 leading-relaxed text-justify whitespace-pre-line">{first.description}</p>
          </div>
        ) : null;

        if (first.slotOptions?.length) {
          // 導航計畫：每月僅一筆 record，slotOptions 是整個月的候選窗口而非單一場次
          // 時間，直接印 startsAt～endsAt 會變成「20:00 - 10:00」這種跨日怪值——
          // 完整保留現有文案與卡層級三態 CTA，分組後仍是一月一卡，行為與現狀等價。
          const remaining = Math.max(0, first.capacity - first.bookedCount);
          const isFull = first.status === 'full' || remaining === 0;
          const notYetOpen = first.status === 'closed';
          return (
            <div className="session-card" key={group.key}>
              {header}
              <div id={panelId} className={`session-content${isOpen ? ' open' : ''}`}>
                <div className="session-content-inner">
                  <div className="p-4 md:p-6 space-y-3">
                    <div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" /> {month} 月・共 {first.slotOptions.length} 個候選時段
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" /> 確切時段於報名頁勾選
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" /> {notYetOpen ? '尚未開放報名' : isFull ? '已額滿' : `剩 ${remaining} 名`}
                      </span>
                    </div>
                    <div className="flex gap-3 pt-2">
                      {notYetOpen ? (
                        <span className="btn-warm py-2 px-4 bg-gray-200 text-gray-500 text-sm pointer-events-none">
                          即將開放，敬請期待
                        </span>
                      ) : isFull ? (
                        <span className="btn-warm py-2 px-4 bg-gray-200 text-gray-500 text-sm pointer-events-none">
                          已額滿
                        </span>
                      ) : (
                        <Link className="btn-warm py-2 px-4 bg-accent-orange text-brown hover:bg-[#FFB74D] text-sm" to={registerPath}>
                          立即報名
                        </Link>
                      )}
                    </div>
                    {showTopic ? (
                      <p className="text-brown font-bold">客座嘉賓：{mystery(first.guest)}</p>
                    ) : null}
                    {descriptionBlock}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // 一般時段組：日期列只在全組同一天才於卡層級出現一次，否則省略、日期改進各時段列。
        const sameDay = group.sessions.every((s) => {
          const d = new Date(s.startsAt);
          const d0 = new Date(first.startsAt);
          return (
            d.getFullYear() === d0.getFullYear() &&
            d.getMonth() === d0.getMonth() &&
            d.getDate() === d0.getDate()
          );
        });
        // showTopic 且卡內僅單一場次時於展開層顯示客座嘉賓列（主題已移至標頭，不重複顯示）；
        // 一組多場次時，個別時段仍可能各有主題，退化為在各時段列尾附 topic 小字（見下方 <li>）。
        const singleTopicRow = showTopic && group.sessions.length === 1;

        return (
          <div className="session-card" key={group.key}>
            {header}
            <div id={panelId} className={`session-content${isOpen ? ' open' : ''}`}>
              <div className="session-content-inner">
                <div className="p-4 md:p-6 space-y-3">
                  {sameDay ? (
                    <span className="flex items-center gap-1 text-sm font-bold text-gray-600">
                      <Calendar className="w-4 h-4" /> {fmtDate(first.startsAt)}
                    </span>
                  ) : null}
                  <ul>
                    {group.sessions.map((s) => {
                      const remaining = Math.max(0, s.capacity - s.bookedCount);
                      const isFull = s.status === 'full' || remaining === 0;
                      const notYetOpen = s.status === 'closed';
                      return (
                        <li
                          key={s.id}
                          className="flex items-center justify-between gap-2 py-2 border-t border-brown/10 first:border-t-0 first:pt-0"
                        >
                          <span>
                            <span className="flex items-center gap-1 text-sm font-bold text-gray-600">
                              <Clock className="w-4 h-4" />
                              {fmtSlotRange(s.startsAt, s.endsAt, !sameDay)}
                            </span>
                            <span className="text-xs font-bold text-gray-500">
                              {notYetOpen ? '尚未開放報名' : isFull ? '已額滿' : `剩 ${remaining} 名`}
                              {!singleTopicRow && showTopic && s.topic ? ` · ${s.topic}` : ''}
                            </span>
                          </span>
                          {isFull || notYetOpen ? (
                            <span className="session-tag bg-gray-200 text-gray-600 shrink-0">
                              {notYetOpen ? '即將開放' : '已額滿'}
                            </span>
                          ) : (
                            <Link
                              to={registerPath}
                              className="btn-warm py-1 px-3 bg-accent-orange text-brown hover:bg-[#FFB74D] text-sm shrink-0"
                            >
                              報名
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {singleTopicRow ? (
                    <p className="text-brown font-bold">客座嘉賓：{mystery(first.guest)}</p>
                  ) : null}
                  {descriptionBlock}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
