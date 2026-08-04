/**
 * 場次管理（03_v4）。列表內直接改名額與截止、用 toggle 上下架；點服務線開場次詳情，
 * 詳情裡編輯主題與客座（＝「公布神秘驚喜」的操作入口）、導航的候選時段，並建 Meet／行事曆。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Project, SessionSlot, SessionStatus } from '@contracts/types';
import { TextInput, Textarea, Select } from '@/components/ui/FormField/FormField';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { adminListProjects, adminListSessions, adminSaveSession, invokeCalendarUpsert } from '@/lib/api';
import { isSupabaseReady } from '@/lib/supabase';
import DemoDataNotice from '../DemoDataNotice';
import { listContacts } from '../operations/api';
import type { ContactRecord } from '../operations/types';
import { EmptyPanel, InlineSpinner, OpsNotice, PageHeader } from '../operations/components';
import { STATUS_LABEL, toLocalInput } from '../operations/RegistrationTable';
import { SESSION_STATUS_TEXT as STATUS_TEXT, SessionTable, sessionDateText as dateText, sessionTimeText as timeText } from '../operations/SessionTable';

function toIso(value: string) { return value ? new Date(value).toISOString() : ''; }

export default function SessionsPage() {
  const live = isSupabaseReady;
  const [sessions, setSessions] = useState<SessionSlot[]>([]); const [projects, setProjects] = useState<Project[]>([]); const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [projectFilter, setProjectFilter] = useState('all'); const [selectedId, setSelectedId] = useState<string>(); const [busyId, setBusyId] = useState<string>();
  const [loading, setLoading] = useState(live); const [notice, setNotice] = useState<string>(); const [error, setError] = useState<string>();
  const [draft, setDraft] = useState<SessionSlot>();

  const reload = useCallback(async () => {
    if (!live) return;
    const [nextSessions, nextProjects, nextContacts] = await Promise.all([adminListSessions(), adminListProjects(), listContacts()]);
    setSessions(nextSessions); setProjects(nextProjects); setContacts(nextContacts);
  }, [live]);
  useEffect(() => { reload().catch((e: unknown) => setError(e instanceof Error ? e.message : '載入場次失敗')).finally(() => setLoading(false)); }, [reload]);

  const projectName = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const current = sessions.find((session) => session.id === selectedId);
  useEffect(() => { setDraft(current ? { ...current } : undefined); }, [selectedId, sessions]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => sessions.filter((session) => projectFilter === 'all' || session.projectId === projectFilter), [sessions, projectFilter]);
  /** 這個場次的報名者；名額爭議時要看得到是誰佔著。 */
  const rosterOf = (sessionId: string) => contacts.flatMap((contact) => contact.registrations.filter((registration) => registration.sessionIds.includes(sessionId)).map((registration) => ({ contact, registration })));

  const save = async (session: SessionSlot, patch: Partial<SessionSlot>, message: string) => {
    if (!live) { setNotice('示意模式：未寫入資料庫。'); return; }
    // 名額不得低於已報名數：DB 沒有這條約束，改小了會讓 booked_count 永遠大於 capacity。
    if (patch.capacity !== undefined && patch.capacity < session.bookedCount) {
      setError(`名額不能小於已報名數（目前 ${session.bookedCount} 人）。要先移轉或退回報名，才能調降名額。`); return;
    }
    // 名額改動後重算額滿狀態；已完成／已取消／未上架的場次不因名額而被改狀態。
    const status = patch.capacity !== undefined && (session.status === 'open' || session.status === 'full')
      ? (session.bookedCount >= patch.capacity ? 'full' : 'open')
      : patch.status ?? session.status;
    setBusyId(session.id);
    try { await adminSaveSession({ ...session, ...patch, status }); await reload(); setNotice(message); setError(undefined); }
    catch (e) { setError(e instanceof Error ? e.message : '儲存失敗'); }
    finally { setBusyId(undefined); }
  };

  const createSession = async () => {
    const projectId = projectFilter !== 'all' ? projectFilter : projects[0]?.id;
    if (!projectId) { setError('沒有可歸屬的專案。'); return; }
    const startsAt = new Date(); startsAt.setHours(startsAt.getHours() + 24, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 3600000);
    await save(
      { id: `draft-${crypto.randomUUID()}`, projectId, title: '新場次（請改標題）', startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), capacity: 1, bookedCount: 0, status: 'closed', instructorIds: [] },
      {}, '已新增場次，狀態為「未上架」——內容確認後再用上架 toggle 公開。',
    );
  };

  const createCalendar = async (session: SessionSlot) => {
    if (!live) { setNotice('示意模式：未建立行事曆事件。'); return; }
    setBusyId(session.id);
    try { const result = await invokeCalendarUpsert(session.id); await reload(); setNotice(result.meetUrl ? `行事曆已建立，Meet：${result.meetUrl}` : '行事曆已建立。'); setError(undefined); }
    catch (e) { setError(e instanceof Error ? e.message : '建立行事曆失敗'); }
    finally { setBusyId(undefined); }
  };

  const patchSlotOption = (index: number, patch: Partial<NonNullable<SessionSlot['slotOptions']>[number]>) => {
    if (!draft?.slotOptions) return;
    setDraft({ ...draft, slotOptions: draft.slotOptions.map((option, i) => (i === index ? { ...option, ...patch } : option)) });
  };

  return <section className="ops-section">
    <PageHeader eyebrow="場次" title="場次管理" description="名額與截止可直接改；上下架用 toggle；點服務線開詳情，主題與客座在那裡公布。" actions={<WarmButton onClick={() => void createSession()}>＋ 新增場次</WarmButton>} />
    {live ? null : <DemoDataNotice />}
    {notice ? <OpsNotice tone="success">{notice}</OpsNotice> : null}{error ? <OpsNotice tone="danger">{error}</OpsNotice> : null}
    <OpsNotice tone="info">名額滿 → 前台自動關閉；未上架的場次不會出現在前台「即將場次」。導航計畫的候選時段在場次詳情逐一調整。建 Meet／行事曆也在詳情裡。</OpsNotice>
    <div className="ops-toolbar">
      <Select label="服務線" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
        <option value="all">全部</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </Select>
    </div>
    {loading ? <InlineSpinner /> : <article className="ops-panel">{filtered.length ? <SessionTable sessions={filtered} handlers={{
      projectName: (projectId) => projectName.get(projectId) ?? '—',
      busyId,
      onOpen: (session) => setSelectedId(session.id),
      onCapacity: (session, capacity) => void save(session, { capacity }, '名額已更新。'),
      onDeadline: (session, value) => void save(session, { registrationDeadline: value ? toIso(value) : undefined }, '報名截止已更新。'),
      onPublish: (session, published) => void save(
        session,
        { status: published ? (session.bookedCount >= session.capacity ? 'full' : 'open') : 'closed' },
        published ? '已上架，前台立即可見。' : '已下架，前台不再顯示。',
      ),
    }} /> : <EmptyPanel title="這個服務線還沒有場次" />}</article>}

    {draft && current ? <><div className="ops-drawer-backdrop" onClick={() => setSelectedId(undefined)} />
      <aside className="ops-drawer">
        <header className="ops-drawer-head">
          <div><p className="ops-eyebrow">{projectName.get(current.projectId)}</p><h2>{dateText(current.startsAt)} {timeText(current.startsAt)}–{timeText(current.endsAt)}</h2><p>{STATUS_TEXT[current.status]}・已報名 {current.bookedCount}/{current.capacity}</p></div>
          <button type="button" className="ops-link-button" onClick={() => setSelectedId(undefined)}>✕ 關閉</button>
        </header>
        <div className="ops-drawer-body">
          <article className="ops-panel">
            <div className="ops-panel-header"><h2>場次資訊</h2></div>
            <div className="ops-form-grid">
              <div className="ops-full"><TextInput label="場次標題" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
              <TextInput type="datetime-local" label="開始時間" value={toLocalInput(draft.startsAt)} onChange={(e) => setDraft({ ...draft, startsAt: toIso(e.target.value) })} />
              <TextInput type="datetime-local" label="結束時間" value={toLocalInput(draft.endsAt)} onChange={(e) => setDraft({ ...draft, endsAt: toIso(e.target.value) })} />
              <TextInput type="number" label="名額" value={String(draft.capacity)} onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })} />
              <TextInput type="datetime-local" label="報名截止" value={toLocalInput(draft.registrationDeadline)} onChange={(e) => setDraft({ ...draft, registrationDeadline: e.target.value ? toIso(e.target.value) : undefined })} />
              <Select label="狀態" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as SessionStatus })}>{(Object.keys(STATUS_TEXT) as SessionStatus[]).map((status) => <option key={status} value={status}>{STATUS_TEXT[status]}</option>)}</Select>
            </div>
            <div className="ops-panel-header" style={{ marginTop: '1rem' }}><div><h2>公布主題與客座</h2><p>兩欄留空時，前台顯示「神秘驚喜！」——填了就等於公布。</p></div></div>
            <div className="ops-form-grid">
              <TextInput label="本場主題" value={draft.topic ?? ''} placeholder="留空＝神秘驚喜！" onChange={(e) => setDraft({ ...draft, topic: e.target.value })} />
              <TextInput label="客座來賓" value={draft.guest ?? ''} placeholder="留空＝神秘驚喜！" onChange={(e) => setDraft({ ...draft, guest: e.target.value })} />
            </div>
            {draft.slotOptions?.length ? <>
              <div className="ops-panel-header" style={{ marginTop: '1rem' }}><div><h2>候選時段（導航計畫）</h2><p>由規則自動換算成確切日期，可逐一手動調整。這 {draft.slotOptions.length} 個時段共用本月 1 個名額。</p></div></div>
              {draft.slotOptions.map((option, index) => <div className="ops-form-grid ops-slot-edit" key={index}>
                <TextInput label={`第 ${index + 1} 個・顯示標籤`} value={option.label} onChange={(e) => patchSlotOption(index, { label: e.target.value })} />
                <TextInput label="備註（前台小字）" value={option.note ?? ''} onChange={(e) => patchSlotOption(index, { note: e.target.value })} />
                <TextInput type="datetime-local" label="開始" value={toLocalInput(option.startsAt)} onChange={(e) => patchSlotOption(index, { startsAt: toIso(e.target.value) })} />
                <TextInput type="datetime-local" label="結束" value={toLocalInput(option.endsAt)} onChange={(e) => patchSlotOption(index, { endsAt: toIso(e.target.value) })} />
              </div>)}
            </> : null}
            <div className="ops-button-row">
              <WarmButton onClick={() => void save(current, draft, '場次已儲存，前台即時更新。')}>儲存場次</WarmButton>
              <WarmButton variant="secondary" onClick={() => void createCalendar(current)}>建立 Meet＋行事曆</WarmButton>
            </div>
            {current.meetUrl ? <p className="ops-cell-muted">目前 Meet：{current.meetUrl}</p> : null}
          </article>

          <article className="ops-panel">
            <div className="ops-panel-header"><div><h2>報名概況</h2><p>已報名 {current.bookedCount}／名額 {current.capacity}</p></div></div>
            {rosterOf(current.id).length ? <div className="ops-list">{rosterOf(current.id).map(({ contact, registration }) => <div className="ops-list-row" key={registration.id}>
              <span><strong>{contact.displayName || registration.email}</strong></span>
              <small>{STATUS_LABEL[registration.status] ?? registration.status}</small>
            </div>)}</div> : <EmptyPanel title="這個場次還沒有報名" />}
          </article>

          <article className="ops-panel">
            <div className="ops-panel-header"><div><h2>行政文件區</h2><p>依本場次現況產生講師行前通知、客座邀請等文件。</p></div></div>
            <OpsNotice tone="warning">文件生成將於 Phase 6 啟用（需先設定 Claude API 金鑰）。在那之前這裡不會產出任何內容。</OpsNotice>
            <div className="ops-form-grid">
              <Select label="文件類型" value="" disabled onChange={() => {}}><option value="">客座分享夥伴邀請信／講師行前通知信／活動計畫書…</option></Select>
              <Textarea label="主題／範圍（給 Claude 的重點）" value="" disabled rows={2} onChange={() => {}} />
            </div>
            <WarmButton disabled onClick={() => {}}>🤖 依場次現況產出草稿（Phase 6）</WarmButton>
          </article>
        </div>
      </aside></> : null}
  </section>;
}
