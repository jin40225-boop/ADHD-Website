import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminListSessions } from '@/lib/api';
import type { SessionSlot } from '@contracts/types';
import { TextInput, Textarea, Select } from '@/components/ui/FormField/FormField';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { createCaseFromRegistration, listContacts, listNotes, moveRegistrationSessions, saveNote, saveTask, transitionRegistration, updateRegistrationAdministration } from '../operations/api';
import type { ContactRecord, InternalNote, OperationalRegistration, WorkPriority } from '../operations/types';
import { EmptyPanel, InlineSpinner, OpsNotice, PageHeader } from '../operations/components';
import {
  DEFAULT_COLUMNS, MailStatusTag, NAVIGATOR_COLUMNS, RegistrationTable, STATUS_LABEL, STATUS_OPTIONS,
  toLocalInput, type RegistrationColumn, type RegistrationPatch, type RowContext,
} from '../operations/RegistrationTable';

// 03_v4 的分頁。導航先照定稿把欄位配齊，其餘沿用共通欄位，3-3 再換上各自的表頭。
const TABS: { slug: string; label: string; columns: RegistrationColumn[] }[] = [
  { slug: 'navigator', label: '導航計畫', columns: NAVIGATOR_COLUMNS },
  { slug: 'parent', label: '親職諮詢', columns: DEFAULT_COLUMNS },
  { slug: 'peer-group', label: '同儕聚會', columns: DEFAULT_COLUMNS },
  { slug: 'all', label: '全部', columns: DEFAULT_COLUMNS },
];
const MAIL_FILTERS: { value: string; label: string }[] = [
  { value: 'not_sent', label: '未寄信' }, { value: 'waiting_reply', label: '等待回覆' }, { value: 'overdue', label: '逾期未回覆' },
  { value: 'reminded', label: '已催覆' }, { value: 'replied_pending', label: '已回覆待處理' }, { value: 'handled', label: '已處理' },
  { value: 'attend_confirmed', label: '已確認出席' }, { value: 'reschedule_requested', label: '請假改期' },
];
// 由報名頁注入、不在 form_schemas 裡的 answers key，給它們可讀標題。
const ANSWER_LABEL: Record<string, string> = { preferredExactSlots: '可配合的確切時段（報名者勾選）', sessionIds: '選擇場次' };

export default function RegistrationsOperationsPage() {
  const [searchParams] = useSearchParams();
  const [contacts, setContacts] = useState<ContactRecord[]>([]); const [sessions, setSessions] = useState<SessionSlot[]>([]); const [selectedId, setSelectedId] = useState<string>(); const [notes, setNotes] = useState<InternalNote[]>([]); const [loading, setLoading] = useState(true); const [notice, setNotice] = useState<string>(); const [error, setError] = useState<string>(); const [busyId, setBusyId] = useState<string>();
  const [tab, setTab] = useState('navigator'); const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState('active'); const [mailFilter, setMailFilter] = useState('all'); const [monthFilter, setMonthFilter] = useState('all');
  const [draft, setDraft] = useState<Partial<OperationalRegistration>>({}); const [answers, setAnswers] = useState<Record<string, string | string[] | Record<string, string | string[]>[]>>({}); const [note, setNote] = useState(''); const [noteType, setNoteType] = useState<'general' | 'eligibility' | 'handoff' | 'risk'>('general'); const [caseSummary, setCaseSummary] = useState('');

  const registrations = useMemo(() => contacts.flatMap((contact) => contact.registrations.map((registration) => ({ registration, contact }))), [contacts]);
  const current = registrations.find(({ registration }) => registration.id === selectedId);
  const sessionById = useMemo(() => new Map(sessions.map((session) => [session.id, session])), [sessions]);
  const sessionOf = (registration: OperationalRegistration) => registration.sessionIds.map((id) => sessionById.get(id)).find(Boolean);
  const activeTab = TABS.find((item) => item.slug === tab) ?? TABS[0];

  const reload = async () => { const [people, slots] = await Promise.all([listContacts(), adminListSessions()]); setContacts(people); setSessions(slots); };
  useEffect(() => { reload().catch((e: unknown) => setError(e instanceof Error ? e.message : '讀取報名失敗')).finally(() => setLoading(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const requested = searchParams.get('registration');
    const match = registrations.find(({ registration }) => registration.id === requested);
    // 從別頁帶 registration 進來時，順手切到它所屬的分頁，不然開了抽屜卻在別的分頁找不到那一列。
    if (match) { setSelectedId(match.registration.id); setTab(TABS.some((t) => t.slug === match.registration.projectSlug) ? match.registration.projectSlug! : 'all'); }
  }, [registrations, searchParams]);
  useEffect(() => { if (!current) return; setDraft({ ...current.registration }); setAnswers({ ...current.registration.answers }); listNotes({ registrationId: current.registration.id }).then(setNotes).catch(() => setNotes([])); }, [selectedId, contacts]); // eslint-disable-line react-hooks/exhaustive-deps

  const inTab = useMemo(() => registrations.filter(({ registration }) => activeTab.slug === 'all' || registration.projectSlug === activeTab.slug), [registrations, activeTab]);
  const months = useMemo(() => [...new Set(inTab.map(({ registration }) => sessionOf(registration)).filter(Boolean).map((session) => new Date(session!.startsAt).getMonth() + 1))].sort((a, b) => a - b), [inTab, sessionById]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => inTab.filter(({ registration, contact }) => {
    const text = `${contact.displayName} ${contact.primaryEmail} ${registration.email} ${registration.projectName}`.toLowerCase();
    if (!text.includes(search.toLowerCase())) return false;
    const active = !['rejected', 'withdrawn', 'cancelled'].includes(registration.status);
    if (statusFilter !== 'all' && (statusFilter === 'active' ? !active : registration.status !== statusFilter)) return false;
    if (mailFilter !== 'all' && (registration.mailStatus?.effective ?? 'not_sent') !== mailFilter) return false;
    if (monthFilter !== 'all') { const session = sessionOf(registration); if (!session || String(new Date(session.startsAt).getMonth() + 1) !== monthFilter) return false; }
    return true;
  }), [inTab, search, statusFilter, mailFilter, monthFilter, sessionById]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchRegistration = async (id: string, input: RegistrationPatch) => {
    setBusyId(id);
    try { await updateRegistrationAdministration(id, input); await reload(); setNotice('已更新並落庫。'); setError(undefined); }
    catch (e) { setError(e instanceof Error ? e.message : '更新失敗'); }
    finally { setBusyId(undefined); }
  };
  const changeStatus = async (id: string, status: string) => {
    setBusyId(id);
    try { await transitionRegistration(id, status); await reload(); setNotice(`狀態已變更為「${STATUS_LABEL[status] ?? status}」，名額同步更新。`); setError(undefined); }
    catch (e) { setError(e instanceof Error ? e.message : '狀態更新失敗'); }
    finally { setBusyId(undefined); }
  };
  const rows: RowContext[] = filtered.map(({ registration, contact }) => ({
    registration, contact, session: sessionOf(registration), busy: busyId === registration.id,
    patch: (input) => void patchRegistration(registration.id, input),
    setStatus: (status) => void changeStatus(registration.id, status),
    open: () => setSelectedId(registration.id),
  }));

  const saveAdmin = async () => { if (!current) return; try { await updateRegistrationAdministration(current.registration.id, { answers, priority: draft.priority as WorkPriority, assignedTo: draft.assignedTo || null, nextActionAt: draft.nextActionAt || null }); await reload(); setNotice('報名資料與行政欄位已更新。'); } catch (e) { setError(e instanceof Error ? e.message : '更新失敗'); } };
  const toggleSession = (id: string) => { const ids = draft.sessionIds ?? []; setDraft({ ...draft, sessionIds: ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id] }); };
  const saveSessions = async () => { if (!current) return; try { await moveRegistrationSessions(current.registration.id, draft.sessionIds ?? []); await reload(); setNotice('報名場次已原子移轉，原場次與新場次名額已同步。'); } catch (e) { setError(e instanceof Error ? e.message : '場次移轉失敗'); } };
  const addNote = async () => { if (!current || !note.trim()) return; await saveNote({ contactId: current.contact.id, registrationId: current.registration.id, noteType, content: note }); setNote(''); setNotes(await listNotes({ registrationId: current.registration.id })); };
  const addTask = async () => { if (!current) return; await saveTask({ projectId: current.registration.projectId, contactId: current.contact.id, registrationId: current.registration.id, title: `跟進報名：${current.contact.displayName}`, priority: draft.priority ?? 'normal', dueAt: draft.nextActionAt, status: 'open' }); setNotice('已建立追蹤待辦。'); };
  const createCase = async () => { if (!current) return; try { await createCaseFromRegistration(current.registration.id, 'ongoing', caseSummary); setNotice('已由報名建立個案，並保留人物與活動關聯。'); setCaseSummary(''); } catch (e) { setError(e instanceof Error ? e.message : '轉案失敗'); } };

  const currentSession = current ? sessionOf(current.registration) : undefined;
  const preferred = current ? current.registration.answers?.preferredExactSlots : undefined;
  const preferredLabels = Array.isArray(preferred) ? preferred.filter((v): v is string => typeof v === 'string') : [];
  const answerEntries = Object.entries(answers);

  return <section className="ops-section">
    <PageHeader eyebrow="受理與審核" title="報名工作台" description="依專案分頁；表格內的狀態、勾選、時段可直接改，點姓名開詳情。" />
    {notice ? <OpsNotice tone="success">{notice}</OpsNotice> : null}{error ? <OpsNotice tone="danger">{error}</OpsNotice> : null}
    <div className="ops-tabs">{TABS.map((item) => <button type="button" key={item.slug} className={`ops-tab ${item.slug === activeTab.slug ? 'ops-tab--active' : ''}`} onClick={() => setTab(item.slug)}>
      {item.label}<small>{registrations.filter(({ registration }) => item.slug === 'all' || registration.projectSlug === item.slug).length}</small>
    </button>)}</div>
    <div className="ops-toolbar">
      <TextInput label="搜尋" placeholder="姓名、Email、計畫" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Select label="審核狀態" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="active">處理中</option><option value="all">全部</option>{STATUS_OPTIONS.map((status) => <option value={status} key={status}>{STATUS_LABEL[status]}</option>)}</Select>
      <Select label="信件狀態" value={mailFilter} onChange={(e) => setMailFilter(e.target.value)}><option value="all">全部</option>{MAIL_FILTERS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</Select>
      {months.length ? <Select label="報名月份" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}><option value="all">全部</option>{months.map((month) => <option value={String(month)} key={month}>{month} 月</option>)}</Select> : null}
    </div>
    {loading ? <InlineSpinner /> : <article className="ops-panel">
      {rows.length ? <RegistrationTable columns={activeTab.columns} rows={rows} /> : <EmptyPanel title="沒有符合條件的報名" />}
    </article>}

    {current ? <><div className="ops-drawer-backdrop" onClick={() => setSelectedId(undefined)} />
      <aside className="ops-drawer">
        <header className="ops-drawer-head">
          <div><p className="ops-eyebrow">{current.registration.projectName}</p><h2>{current.contact.displayName || current.registration.email}</h2><p>{current.registration.email}</p></div>
          <button type="button" className="ops-link-button" onClick={() => setSelectedId(undefined)}>✕ 關閉</button>
        </header>
        <div className="ops-drawer-body">
          <article className="ops-panel">
            <div className="ops-button-row"><Link className="ops-link-button" to={`/admin/inbox?registration=${current.registration.id}`}>查看信件往來</Link><Link className="ops-link-button" to={`/admin/people?contact=${current.contact.id}`}>人物主檔</Link></div>
            <div className="ops-form-grid">
              <Select label="報名狀態" value={current.registration.status} onChange={(e) => void changeStatus(current.registration.id, e.target.value)}>{(STATUS_OPTIONS.includes(current.registration.status) ? STATUS_OPTIONS : [current.registration.status, ...STATUS_OPTIONS]).map((status) => <option value={status} key={status}>{STATUS_LABEL[status] ?? status}</option>)}</Select>
              <Select label="優先度" value={draft.priority ?? 'normal'} onChange={(e) => setDraft({ ...draft, priority: e.target.value as WorkPriority })}><option value="low">低</option><option value="normal">一般</option><option value="high">高</option><option value="urgent">緊急</option></Select>
              <TextInput type="datetime-local" label="下一步時間" value={draft.nextActionAt?.slice(0, 16) ?? ''} onChange={(e) => setDraft({ ...draft, nextActionAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
              <TextInput label="負責人 UUID" value={draft.assignedTo ?? ''} onChange={(e) => setDraft({ ...draft, assignedTo: e.target.value })} placeholder="可留空" />
            </div>
            <div className="ops-kv">
              <div><dt>✉ 信件狀態</dt><dd><MailStatusTag registration={current.registration} /></dd></div>
              <div><dt>☑ 已寄信提醒</dt><dd><label className="ops-inline-check"><input type="checkbox" checked={Boolean(current.registration.reminderSentAt)} onChange={(e) => void patchRegistration(current.registration.id, { reminderSentAt: e.target.checked ? new Date().toISOString() : null })} />{current.registration.reminderSentAt ? new Date(current.registration.reminderSentAt).toLocaleString('zh-TW') : '尚未寄送'}</label></dd></div>
              <div><dt>◉ 諮商師回覆確認</dt><dd><Select label="" value={current.registration.counselorConfirmed === true ? 'yes' : current.registration.counselorConfirmed === false ? 'no' : ''} onChange={(e) => void patchRegistration(current.registration.id, { counselorConfirmed: e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null })}><option value="">—</option><option value="yes">可</option><option value="no">不可</option></Select></dd></div>
              <div><dt>✅ 最終確定時段</dt><dd><TextInput type="datetime-local" label="" value={toLocalInput(current.registration.finalSlotAt)} onChange={(e) => void patchRegistration(current.registration.id, { finalSlotAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></dd></div>
            </div>
            {currentSession?.slotOptions?.length ? <div className="ops-slot-picker">
              <p>本月候選時段（★ 為報名者勾選）— 點一下即帶入「最終確定時段」：</p>
              <div className="ops-button-row">{currentSession.slotOptions.map((option) => {
                const chosen = preferredLabels.some((label) => label.includes(option.label));
                return <button type="button" key={option.startsAt} className={`ops-slot-option ${chosen ? 'ops-slot-option--chosen' : ''}`} onClick={() => void patchRegistration(current.registration.id, { finalSlotAt: option.startsAt })}>
                  {chosen ? '★ ' : ''}{option.label}{option.note ? <small>{option.note}</small> : null}
                </button>;
              })}</div>
              <small>建行事曆與 Meet 尚未接上（Phase 3-4 場次管理），目前只寫入時間。</small>
            </div> : null}
            <div className="ops-button-row"><WarmButton onClick={() => void saveAdmin()}>儲存行政欄位</WarmButton><WarmButton variant="secondary" onClick={() => void addTask()}>建立追蹤</WarmButton></div>
          </article>
          <article className="ops-panel"><div className="ops-panel-header"><div><h2>完整表單內容</h2><p>可補正缺漏資訊；所有欄位完整保留。</p></div></div>{answerEntries.length ? <div className="ops-form-grid">{answerEntries.map(([key, value]) => <Textarea key={key} label={ANSWER_LABEL[key] ?? key} value={Array.isArray(value) ? value.map((v) => typeof v === 'string' ? v : JSON.stringify(v)).join('\n') : typeof value === 'string' ? value : JSON.stringify(value)} onChange={(e) => setAnswers({ ...answers, [key]: Array.isArray(value) ? e.target.value.split('\n').filter(Boolean) : e.target.value })} />)}</div> : <EmptyPanel title="這筆報名沒有表單內容" />}</article>
          <article className="ops-panel"><div className="ops-panel-header"><h2>場次移轉</h2></div><div className="ops-list">{sessions.filter((s) => s.projectId === current.registration.projectId).map((session) => <label className="ops-list-row" key={session.id}><span><input type="checkbox" checked={(draft.sessionIds ?? []).includes(session.id)} onChange={() => toggleSession(session.id)} /> <strong>{session.title}</strong></span><small>{new Date(session.startsAt).toLocaleString('zh-TW')} · {session.bookedCount}/{session.capacity}</small></label>)}</div><WarmButton onClick={() => void saveSessions()}>確認移轉場次</WarmButton></article>
          <article className="ops-panel"><div className="ops-panel-header"><h2>內部註記</h2></div><div className="ops-form-grid"><Select label="類型" value={noteType} onChange={(e) => setNoteType(e.target.value as typeof noteType)}><option value="general">一般</option><option value="eligibility">資格審核</option><option value="handoff">交接</option><option value="risk">風險</option></Select><div className="ops-full"><Textarea label="註記內容" rows={4} value={note} onChange={(e) => setNote(e.target.value)} /></div></div><WarmButton onClick={() => void addNote()}>新增註記</WarmButton>{notes.map((item) => <div className="ops-note" key={item.id}><p>{item.content}</p><small>{item.noteType} · 第 {item.revision} 版 · {new Date(item.createdAt).toLocaleString('zh-TW')}</small></div>)}</article>
          <article className="ops-panel"><div className="ops-panel-header"><div><h2>轉為持續服務個案</h2><p>保留原報名、人物、活動和信件關聯。</p></div></div><Textarea label="轉案摘要" value={caseSummary} onChange={(e) => setCaseSummary(e.target.value)} /><WarmButton onClick={() => void createCase()}>建立個案</WarmButton></article>
        </div>
      </aside></> : null}
  </section>;
}
