import { useEffect, useState } from 'react';
import type { SessionSlot, SessionStatus } from '@contracts/types';
import { toLocalInput } from './RegistrationTable';

export const SESSION_STATUS_TEXT: Record<SessionStatus, string> = { open: '開放中', full: '額滿', closed: '未上架', done: '已完成', cancelled: '已取消' };
const SESSION_STATUS_TONE: Record<SessionStatus, string> = { open: 'green', full: 'orange', closed: 'gray', done: 'gray', cancelled: 'red' };
/** 已完成／已取消的場次不再上下架，避免用 toggle 把歷史場次重新掛回前台。 */
export const LOCKED_STATUSES: SessionStatus[] = ['done', 'cancelled'];

export const sessionDateText = (iso: string) => new Date(iso).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' });
export const sessionTimeText = (iso: string) => new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

export interface SessionTableHandlers {
  projectName: (projectId: string) => string;
  busyId?: string;
  onOpen: (session: SessionSlot) => void;
  onCapacity: (session: SessionSlot, capacity: number) => void;
  onDeadline: (session: SessionSlot, iso?: string) => void;
  onPublish: (session: SessionSlot, published: boolean) => void;
}

/**
 * 名額格。受控＋離開欄位才送出：非受控的話，儲存被名額守衛擋下後，每次離開欄位都會
 * 重試同一筆失敗寫入，而且格子裡的數字會停在被拒絕的值、與資料庫脫節。
 */
function CapacityCell({ session, busy, onCapacity }: { session: SessionSlot; busy: boolean; onCapacity: (session: SessionSlot, capacity: number) => void }) {
  const [value, setValue] = useState(String(session.capacity));
  useEffect(() => { setValue(String(session.capacity)); }, [session.capacity]);
  const commit = () => {
    const next = Number(value);
    // 低於已報名數的名額會被上層擋下；在這裡就還原，格子才不會停在一個資料庫根本沒接受的數字。
    if (!Number.isFinite(next) || next < Math.max(1, session.bookedCount) || next === session.capacity) {
      setValue(String(session.capacity));
      return;
    }
    onCapacity(session, next);
  };
  return <input
    type="number" className="ops-cell-number" min={Math.max(1, session.bookedCount)} value={value} disabled={busy}
    onChange={(e) => setValue(e.target.value)} onBlur={commit}
    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setValue(String(session.capacity)); }}
  />;
}

export function SessionTable({ sessions, handlers }: { sessions: SessionSlot[]; handlers: SessionTableHandlers }) {
  const { projectName, busyId, onOpen, onCapacity, onDeadline, onPublish } = handlers;
  return <div className="ops-table-wrap">
    <table className="ops-table ops-table--editable">
      <thead><tr><th>服務線</th><th>日期</th><th>時段</th><th>名額（可改）</th><th>已報名</th><th>截止（可改）</th><th>狀態</th><th>上架</th></tr></thead>
      <tbody>{sessions.map((session) => {
        const busy = busyId === session.id;
        const locked = LOCKED_STATUSES.includes(session.status);
        return <tr key={session.id} className={busy ? 'ops-row--busy' : undefined}>
          <td><button type="button" className="ops-cell-name" onClick={() => onOpen(session)}>
            <strong>{projectName(session.projectId)}</strong> ▸<br /><span className="ops-cell-muted">{session.title}</span>
          </button></td>
          <td><span className="ops-cell-muted">{sessionDateText(session.startsAt)}</span></td>
          <td><span className="ops-cell-muted">{sessionTimeText(session.startsAt)}–{sessionTimeText(session.endsAt)}</span></td>
          <td><CapacityCell session={session} busy={busy} onCapacity={onCapacity} /></td>
          <td><span className="ops-cell-muted">{session.bookedCount}</span></td>
          <td><input
            type="datetime-local" className="ops-cell-datetime" value={toLocalInput(session.registrationDeadline)} disabled={busy}
            onChange={(e) => onDeadline(session, e.target.value || undefined)}
          /></td>
          <td><span className={`ops-status ops-status--${SESSION_STATUS_TONE[session.status]}`}>{SESSION_STATUS_TEXT[session.status]}</span></td>
          <td>{locked ? <span className="ops-cell-muted">—</span> : <label className="ops-switch">
            <input type="checkbox" checked={session.status !== 'closed'} disabled={busy} onChange={(e) => onPublish(session, e.target.checked)} />
            <span className="ops-switch-slider" />
          </label>}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
