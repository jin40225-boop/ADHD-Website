/**
 * 場次管理路由頁。【CLAUDE 整合層】
 * Supabase 已設定時為真實 CRUD（前台報名頁即時讀取這裡建立的場次）；
 * 未設定時退回本地示意資料。onCreateCalendarEvent 待 K2（Google Edge Functions）。
 */
import { useCallback, useEffect, useState } from 'react';
import type { Project, SessionSlot } from '@contracts/types';
import { SessionManager, mockInstructors, mockSessions } from '@/features/session-manager';
import { adminListProjects, adminListSessions, adminSaveSession, invokeCalendarUpsert } from '@/lib/api';
import { isSupabaseReady } from '@/lib/supabase';
import DemoDataNotice from '../DemoDataNotice';

/** ISO timestamptz ↔ datetime-local 值互轉（SessionManager 的時間欄位用 datetime-local）。 */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function toIso(value: string): string {
  const d = new Date(value);
  return Number.isNaN(+d) ? value : d.toISOString();
}

export default function SessionsPage() {
  const live = isSupabaseReady;
  const [sessions, setSessions] = useState<SessionSlot[]>(live ? [] : mockSessions);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [loading, setLoading] = useState(live);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    if (!live) return;
    try {
      const [ss, ps] = await Promise.all([adminListSessions(), adminListProjects()]);
      setSessions(ss.map((s) => ({ ...s, startsAt: toLocalInput(s.startsAt), endsAt: toLocalInput(s.endsAt) })));
      setProjects(ps);
      setProjectId((current) => current || ps[0]?.id || '');
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入場次失敗');
    } finally {
      setLoading(false);
    }
  }, [live]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSave = async (session: SessionSlot) => {
    setNotice(undefined);
    setError(undefined);
    if (!live) {
      setSessions((prev) => {
        const exists = prev.some((item) => item.id === session.id);
        return exists ? prev.map((item) => (item.id === session.id ? session : item)) : [...prev, session];
      });
      return;
    }
    try {
      await adminSaveSession({
        ...session,
        projectId: session.projectId || projectId,
        startsAt: toIso(session.startsAt),
        endsAt: toIso(session.endsAt),
      });
      await reload();
      setNotice(`「${session.title || '未命名場次'}」已儲存，前台報名頁將即時顯示。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗');
    }
  };

  const handleCreateCalendarEvent = async (session: SessionSlot) => {
    setNotice(undefined);
    setError(undefined);
    if (!live) {
      setNotice('示意模式：未建立行事曆事件。');
      return;
    }
    if (session.id.startsWith('draft-')) {
      setError('請先儲存場次，再建立 Meet／行事曆。');
      return;
    }
    try {
      setNotice(`正在為「${session.title}」建立 Google Meet／行事曆…`);
      const result = await invokeCalendarUpsert(session.id);
      await reload();
      setNotice(
        result.meetUrl
          ? `「${session.title}」行事曆已建立，Meet 連結：${result.meetUrl}`
          : `「${session.title}」行事曆已建立。`,
      );
    } catch (err) {
      setNotice(undefined);
      setError(err instanceof Error ? err.message : '建立行事曆失敗');
    }
  };

  return (
    <div>
      {live ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border-2 border-brown/40 bg-accent-teal/20 px-4 py-2.5 text-sm">
          <strong>真實資料模式</strong>
          <span>新增/編輯即時寫入資料庫；新場次歸屬專案：</span>
          <select
            className="rounded-lg border-2 border-brown bg-white px-2 py-1"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <DemoDataNotice />
      )}
      {notice ? (
        <p role="status" className="mb-4 rounded-xl border-2 border-brown/40 bg-accent-blue/30 px-4 py-2.5 text-sm">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 rounded-xl border-2 border-alert-red bg-alert-red/10 px-4 py-2.5 text-sm font-bold">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="p-6 text-center text-brown/60">載入場次中…</p>
      ) : (
        <SessionManager
          sessions={sessions}
          instructors={mockInstructors}
          onSave={handleSave}
          onCreateCalendarEvent={handleCreateCalendarEvent}
        />
      )}
    </div>
  );
}
