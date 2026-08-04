/**
 * 活動軌跡（裁決 6）。
 *
 * 過期場次不下架、永久留存，依年度摺疊、標示「已結束」，讓新朋友看見社群的累積。
 * 資料來自 `sessions_public` 且只取 `status='done'`：
 *   - `cancelled`（含測試資料）與未上架場次永遠不會出現在公開軌跡；
 *   - view 不含 `meet_url`，歷史 Meet 連結因此自然下架。
 */
import { useEffect, useState } from 'react';
import { CalendarCheck, ChevronDown } from 'lucide-react';
import { getPastSessions, getProjectBySlug } from '@/lib/api';
import type { SessionSlot } from '@contracts/types';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 西元轉民國，配合站上既有的「115 年」用法。 */
function rocYear(iso: string) {
  return new Date(iso).getFullYear() - 1911;
}

/** 一個要納入軌跡的服務；`label` 有值時，該服務的場次會標上服務標籤。 */
export interface SessionHistorySource {
  slug: string;
  label?: string;
}

export interface SessionHistoryProps {
  /** 要合併顯示的服務。多個服務會依日期交錯排列（首頁用）。 */
  projects?: SessionHistorySource[];
  /** 標題文字；不同服務頁可自訂。 */
  title?: string;
  description?: string;
}

type TaggedSession = SessionSlot & { serviceLabel?: string };

export function SessionHistory({
  projects = [{ slug: 'peer-group' }],
  title = '👣 活動軌跡・已完成場次',
  description = '這些是我們過去美好的回憶！所有場次永久留存，讓新朋友看見這個社群的累積。',
}: SessionHistoryProps) {
  const [sessions, setSessions] = useState<TaggedSession[] | null>(null);
  // 依 slug 比對即可，避免呼叫端每次 render 傳入新陣列而重跑。
  const sourceKey = projects.map((p) => `${p.slug}:${p.label ?? ''}`).join(',');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const lists = await Promise.all(projects.map(async (source) => {
          const project = await getProjectBySlug(source.slug);
          if (!project) return [];
          const list = await getPastSessions(project.id);
          return list.map((s) => ({ ...s, serviceLabel: source.label }));
        }));
        const merged = lists.flat().sort((a, b) => b.startsAt.localeCompare(a.startsAt));
        if (alive) setSessions(merged);
      } catch {
        if (alive) setSessions([]);
      }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  if (sessions === null || sessions.length === 0) return null;

  const years = [...new Set(sessions.map((s) => rocYear(s.startsAt)))].sort((a, b) => b - a);

  return (
    <section className="max-w-4xl mx-auto px-4 mt-16" aria-label="活動軌跡">
      <div className="bg-white border-2 border-brown rounded-3xl p-6 md:p-8 shadow-[8px_8px_0_rgba(93,64,55,0.15)]">
        <h2 className="font-heading text-2xl font-black text-brown flex items-center gap-2">
          <CalendarCheck className="w-6 h-6" aria-hidden="true" /> {title}
        </h2>
        <p className="text-gray-600 mt-2 mb-4">{description}</p>
        {years.map((year, index) => {
          const items = sessions.filter((s) => rocYear(s.startsAt) === year);
          return (
            <details key={year} open={index === 0} className="border-t-2 border-dashed border-brown/20 pt-3 mt-3">
              <summary className="cursor-pointer font-heading font-black text-brown flex items-center gap-2">
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
                📂 {year} 年（{items.length} 場）
              </summary>
              <ul className="mt-3 space-y-3 list-none p-0">
                {items.map((s) => (
                  <li key={s.id} className="bg-cream border-2 border-brown/15 rounded-2xl p-4">
                    <span className="inline-block bg-gray-200 text-gray-600 text-xs font-bold px-3 py-1 rounded-full border border-brown/20">
                      已結束
                    </span>
                    {s.serviceLabel ? (
                      <span className="inline-block bg-white text-brown/70 text-xs font-bold px-3 py-1 rounded-full border border-brown/20 ml-2">
                        {s.serviceLabel}
                      </span>
                    ) : null}
                    <p className="font-bold text-brown mt-2">
                      {fmt(s.startsAt)} {s.topic ?? s.title}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {s.guest ? <>客座嘉賓：{s.guest}｜</> : null}
                      {fmtTime(s.startsAt)}–{fmtTime(s.endsAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}
