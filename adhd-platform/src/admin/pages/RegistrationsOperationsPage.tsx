import { useEffect, useMemo, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminListEmailTemplates, adminListFormSchemas, adminListProjects, adminListSessions, invokeSendEmail } from '@/lib/api';
import type { EmailTemplate, FormSchema, Project, SessionSlot } from '@contracts/types';
import { TEMPLATE_VARIABLES, applyTemplate, buildContext, letterKindOf, withReplyDeadline } from '../operations/emailCompose';
import { TextInput, Textarea, Select } from '@/components/ui/FormField/FormField';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { createCaseFromRegistration, createEmailAttachmentUrl, getAppSettings, importGmailHistory, listContacts, listNotes, markThreadRead, moveRegistrationSessions, saveNote, saveTask, transitionRegistration, updateRegistrationAdministration } from '../operations/api';
import type { ContactRecord, InternalNote, OperationalRegistration, WorkPriority } from '../operations/types';
import { EmptyPanel, InlineSpinner, OpsNotice, PageHeader, SavingIndicator, StatusPill } from '../operations/components';
import {
  CAREER_COLUMNS, DEFAULT_COLUMNS, MailOverrideEditor, MailStatusTag, MULTI_SESSION_SLUGS, NAVIGATOR_COLUMNS, PARENT_COLUMNS, PEER_COLUMNS, RegistrationTable, STATUS_LABEL, STATUS_OPTIONS,
  toLocalInput, type RegistrationColumn, type RegistrationPatch, type RowContext,
} from '../operations/RegistrationTable';
import { answerLabel, buildAnswerLabelIndex, formatAnswerValue } from '../operations/answerLabels';
import { SessionRosterPanel } from '../operations/SessionRosterDrawer';
import { groupTemplates } from '../operations/templateGroups';

// 03_v4 的分頁，各自的表頭。「全部」是安全網：專案沒有分頁的報名不會消失。
const TABS: { slug: string; label: string; columns: RegistrationColumn[] }[] = [
  { slug: 'navigator', label: '導航計畫', columns: NAVIGATOR_COLUMNS },
  { slug: 'parent', label: '親職諮詢', columns: PARENT_COLUMNS },
  { slug: 'peer-group', label: '同儕聚會', columns: PEER_COLUMNS },
  { slug: 'career', label: '職場諮詢', columns: CAREER_COLUMNS },
  // 協辦活動刻意沒有分頁：報名在主辦單位的表單，本站不會有那些活動的報名資料。
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
  const [templates, setTemplates] = useState<EmailTemplate[]>([]); const [followUpDays, setFollowUpDays] = useState<number>();
  // 報名表定義：答案的中文問法唯一的來源。讀不到就退回顯示原始 key，不猜中文。
  const [schemas, setSchemas] = useState<Record<string, FormSchema>>({}); const [projects, setProjects] = useState<Project[]>([]);
  /** 從「場次移轉」開出的名冊抽屜。與報名詳情抽屜互斥——兩個 ops-drawer 都是 fixed，同時開會疊在一起。 */
  const [rosterSessionId, setRosterSessionId] = useState<string>();
  // attachButtons 預設 false：沒有選範本就無從判斷這是不是要對方回覆出席的信，
  // 而多附兩個確認連結是寄出去才會發現的錯，少附則當場看得到那個沒勾的框。
  const [compose, setCompose] = useState({ templateId: '', subject: '', body: '', attachButtons: false, isFollowUp: false, cc: [] as string[] });
  const [missingVars, setMissingVars] = useState<string[]>([]); const [sending, setSending] = useState(false); const [confirmingImport, setConfirmingImport] = useState(false);
  /** 信件往來面板：預設只看最近 5 封，展開才看全部。`mailRead` 是這一輪已把未讀清掉的本地標記。 */
  const [mailExpanded, setMailExpanded] = useState(false); const [mailRead, setMailRead] = useState(false);

  const registrations = useMemo(() => contacts.flatMap((contact) => contact.registrations.map((registration) => ({ registration, contact }))), [contacts]);
  const current = registrations.find(({ registration }) => registration.id === selectedId);
  const sessionById = useMemo(() => new Map(sessions.map((session) => [session.id, session])), [sessions]);
  const labelIndex = useMemo(() => buildAnswerLabelIndex(schemas), [schemas]);
  /** 名冊照抄 `SessionsPage.tsx` 的 `rosterOf`——同一顆面板要吃同一種形狀的資料，不另外算一套。 */
  const rosterOf = (sessionId: string) => contacts.flatMap((contact) => contact.registrations.filter((registration) => registration.sessionIds.includes(sessionId)).map((registration) => ({ contact, registration })));
  const sessionOf = (registration: OperationalRegistration) => registration.sessionIds.map((id) => sessionById.get(id)).find(Boolean);
  /** 這筆報名實際佔住的所有場次，依時間排序——清單要看得出「一筆佔了兩個時段」。 */
  const heldSessionsOf = (registration: OperationalRegistration) => registration.sessionIds
    .map((id) => sessionById.get(id))
    .filter((session): session is SessionSlot => Boolean(session))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const activeTab = TABS.find((item) => item.slug === tab) ?? TABS[0];

  const reload = async () => {
    const [people, slots, mailTemplates, settings, formSchemas, projectList] = await Promise.all([listContacts(), adminListSessions(), adminListEmailTemplates(), getAppSettings(), adminListFormSchemas(), adminListProjects()]);
    setContacts(people); setSessions(slots); setTemplates(mailTemplates); setFollowUpDays(settings.followUpDays); setSchemas(formSchemas); setProjects(projectList);
  };
  useEffect(() => { reload().catch((e: unknown) => setError(e instanceof Error ? e.message : '讀取報名失敗')).finally(() => setLoading(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const requested = searchParams.get('registration');
    const match = registrations.find(({ registration }) => registration.id === requested);
    // 從別頁帶 registration 進來時，順手切到它所屬的分頁，不然開了抽屜卻在別的分頁找不到那一列。
    // 順手關掉名冊抽屜：名冊裡「開這個人的寄信面板」連的就是本頁的 ?registration=，
    // 不關的話那一點會看起來毫無反應——詳情抽屜被名冊蓋著（兩個抽屜刻意互斥）。
    if (match) { setRosterSessionId(undefined); setSelectedId(match.registration.id); setTab(TABS.some((t) => t.slug === match.registration.projectSlug) ? match.registration.projectSlug! : 'all'); }
  }, [registrations, searchParams]);
  useEffect(() => { if (!current) return; setDraft({ ...current.registration }); setAnswers({ ...current.registration.answers }); listNotes({ registrationId: current.registration.id }).then(setNotes).catch(() => setNotes([])); }, [selectedId, contacts]); // eslint-disable-line react-hooks/exhaustive-deps
  /**
   * 打開抽屜就等於看過這個人的往來，未讀跟著消——與收件匣同一套規則
   * （`InboxPage.tsx`：`if (selected?.hasUnread) void markThreadRead(`）。
   * 一筆報名的往來可能散在多條 thread，所以對訊息裡不重複的 threadId 各清一次。
   * 清完只翻本地的 `mailRead` 而不 reload：這半邊刻意零新查詢，為了收掉一個紅點
   * 重抓一次全站聯絡人與信件不划算。
   */
  useEffect(() => {
    setMailExpanded(false); setMailRead(false);
    const registration = current?.registration;
    if (!registration || !hasUnreadMail(registration)) return;
    const threadIds = [...new Set((registration.messages ?? []).map((message) => message.threadId).filter(Boolean))];
    if (!threadIds.length) return;
    let left = false;
    void Promise.all(threadIds.map((id) => markThreadRead(id))).then(() => { if (!left) setMailRead(true); }).catch(() => undefined);
    return () => { left = true; };
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    try {
      const target = registrations.find(({ registration }) => registration.id === id)?.registration;
      // 信箱同時是名冊比對鍵與表單答案，只改一邊會讓兩份資料各說各話。
      const answersPatch = input.email && typeof target?.answers?.email === 'string'
        ? { answers: { ...target.answers, email: input.email.trim().toLowerCase() } }
        : {};
      await updateRegistrationAdministration(id, { ...input, ...answersPatch });
      await reload(); setNotice('已更新並落庫。'); setError(undefined);
    }
    catch (e) { setError(e instanceof Error ? e.message : '更新失敗'); }
    finally { setBusyId(undefined); }
  };
  const changeSessions = async (id: string, sessionIds: string[]) => {
    setBusyId(id);
    try { await moveRegistrationSessions(id, sessionIds); await reload(); setNotice('場次已原子移轉，原場次與新場次名額同步更新。'); setError(undefined); }
    catch (e) { setError(e instanceof Error ? e.message : '場次移轉失敗'); }
    finally { setBusyId(undefined); }
  };
  const changeStatus = async (id: string, status: string) => {
    setBusyId(id);
    try { await transitionRegistration(id, status); await reload(); setNotice(`狀態已變更為「${STATUS_LABEL[status] ?? status}」，名額同步更新。`); setError(undefined); }
    catch (e) { setError(e instanceof Error ? e.message : '狀態更新失敗'); }
    finally { setBusyId(undefined); }
  };
  const rows: RowContext[] = filtered.map(({ registration, contact }) => ({
    registration, contact, session: sessionOf(registration), heldSessions: heldSessionsOf(registration), busy: busyId === registration.id,
    projectSessions: sessions.filter((session) => session.projectId === registration.projectId),
    patch: (input) => void patchRegistration(registration.id, input),
    setStatus: (status) => void changeStatus(registration.id, status),
    setSessions: (sessionIds) => void changeSessions(registration.id, sessionIds),
    open: () => setSelectedId(registration.id),
  }));

  /**
   * 名額對帳。
   *
   * 統計對象是 `inTab`（這條服務線的**全部**報名），不是 `filtered`——用篩選後的清單
   * 統計會讓「審核狀態＝處理中」之類的預設篩選把待處理的筆數藏起來，變成一個看起來
   * 是 0、其實不是 0 的數字。
   *
   * 判斷一筆是否還佔著名額一律看 `capacityReleasedAt`，不看狀態：釋放是
   * `admin_transition_registration` 蓋的時間戳，而狀態可以被人工改成任何值。
   *
   * `mismatch` 是自我稽核：場次自己記的 `booked_count` 總和，應該等於這些報名宣稱
   * 佔住的席次數。對不上就代表有席次的持有者不在這份清單裡——例如聯絡人被封存
   * （`listContacts` 只取 archived_at is null），那筆報名就會整個從工作台消失，
   * 名額卻還鎖著。這種情況沒有任何畫面會提示，只能靠對帳看出來。
   */
  const seatAudit = useMemo(() => {
    const holders = inTab.filter(({ registration }) => !registration.capacityReleasedAt);
    const claimed = holders.reduce((n, { registration }) => n + registration.sessionIds.filter((id) => sessionById.has(id)).length, 0);
    const over = holders.reduce(
      (acc, { registration }) => {
        const held = registration.sessionIds.filter((id) => sessionById.has(id)).length;
        return held > 1 ? { count: acc.count + 1, extra: acc.extra + held - 1 } : acc;
      },
      { count: 0, extra: 0 },
    );
    const projectIds = new Set(inTab.map(({ registration }) => registration.projectId));
    const booked = sessions
      .filter((session) => projectIds.has(session.projectId))
      .reduce((n, session) => n + session.bookedCount, 0);
    return { ...over, claimed, booked, mismatch: projectIds.size ? booked - claimed : 0 };
  }, [inTab, sessions, sessionById]);
  const overHeld = seatAudit;

  const saveAdmin = async () => { if (!current) return; try { await updateRegistrationAdministration(current.registration.id, { answers, priority: draft.priority as WorkPriority, assignedTo: draft.assignedTo || null, nextActionAt: draft.nextActionAt || null }); await reload(); setNotice('報名資料與行政欄位已更新。'); } catch (e) { setError(e instanceof Error ? e.message : '更新失敗'); } };
  const toggleSession = (id: string) => { const ids = draft.sessionIds ?? []; setDraft({ ...draft, sessionIds: ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id] }); };
  const saveSessions = async () => { if (!current) return; try { await moveRegistrationSessions(current.registration.id, draft.sessionIds ?? []); await reload(); setNotice('報名場次已原子移轉，原場次與新場次名額已同步。'); } catch (e) { setError(e instanceof Error ? e.message : '場次移轉失敗'); } };
  // 註記只掛報名，不同時掛聯絡人：internal_notes 有 `num_nonnulls(contact_id, registration_id, case_id) = 1`
  // 的約束，兩個都給會被 DB 以 23514 擋下。下一行的 listNotes 本來就只用 registrationId 讀回來。
  const addNote = async () => { if (!current || !note.trim()) return; try { await saveNote({ registrationId: current.registration.id, noteType, content: note }); setNote(''); setNotes(await listNotes({ registrationId: current.registration.id })); setNotice('內部註記已儲存。'); } catch (e) { setError(e instanceof Error ? e.message : '儲存註記失敗'); } };
  const addTask = async () => { if (!current) return; try { await saveTask({ projectId: current.registration.projectId, contactId: current.contact.id, registrationId: current.registration.id, title: `跟進報名：${current.contact.displayName}`, priority: draft.priority ?? 'normal', dueAt: draft.nextActionAt, status: 'open' }); setNotice('已建立追蹤待辦。'); } catch (e) { setError(e instanceof Error ? e.message : '建立追蹤待辦失敗'); } };
  const createCase = async () => { if (!current) return; try { await createCaseFromRegistration(current.registration.id, 'ongoing', caseSummary); setNotice('已由報名建立個案，並保留人物與活動關聯。'); setCaseSummary(''); } catch (e) { setError(e instanceof Error ? e.message : '轉案失敗'); } };

  /**
   * 匯入這個人的完整歷史往來。不受「自動收信起始日」限制——起始日管的是系統自己去找什麼，
   * 不是你能拿什麼。要跟這位家長談之前按一下，往來就會排進佇列等同步抓內容。
   */
  const importHistory = async () => {
    const email = current?.registration.email || current?.contact.primaryEmail;
    if (!email) { setError('這筆報名沒有信箱，無法匯入往來。'); return; }
    setConfirmingImport(false);
    try {
      const result = await importGmailHistory(email);
      setNotice(`找到 ${result.found} 封往來，其中 ${result.alreadyStored} 封已經收過；新排入佇列 ${result.queued} 封。請到整合設定按同步把內容抓進來。`);
      setError(undefined);
    } catch (e) { setError(e instanceof Error ? e.message : '匯入歷史往來失敗'); }
  };

  /** 載入範本：變數在這裡就替換完成，使用者審閱到的即是實際會寄出的字。 */
  const loadTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!current || !template) { setCompose({ ...compose, templateId, subject: '', body: '', attachButtons: false, isFollowUp: false }); setMissingVars([]); return; }
    const context = buildContext(current.registration, current.contact, sessions, `${location.origin}${import.meta.env.BASE_URL}`);
    const subject = applyTemplate(template.subject, context);
    const body = applyTemplate(template.body, context);
    // 催覆信（出席確認信）預設帶回覆期限，期限＝設定裡的逾期門檻天數（app_settings.follow_up_days）。
    // 讀不到就不寫期限——信上一個與後台不符的日期，比沒有日期更難收拾。
    const kind = letterKindOf(template);
    const isFollowUp = kind === 'follow_up';
    const hasSession = current.registration.sessionIds.length > 0;
    const deadline = followUpDays === undefined ? undefined : new Date(Date.now() + followUpDays * 86400000);
    setCompose({
      ...compose, templateId, subject: subject.text,
      body: isFollowUp && deadline ? withReplyDeadline(body.text, deadline) : body.text,
      isFollowUp,
      // 確認按鈕只對「要對方回覆出席與否」的信有意義，而且要有場次可掛——沒有場次的 token
      // 會帶著 session_id = null 存進去，事後看不出那次確認是針對哪一場。
      attachButtons: hasSession && (kind === 'confirm' || kind === 'follow_up'),
    });
    setMissingVars([...new Set([...subject.missing, ...body.missing])]);
  };
  const sendMail = async () => {
    if (!current || !compose.subject.trim() || !compose.body.trim()) { setError('主旨與內容都要填。'); return; }
    setSending(true);
    try {
      const result = await invokeSendEmail({
        registrationId: current.registration.id, subject: compose.subject, body: compose.body,
        cc: compose.cc, attachConfirmButtons: compose.attachButtons, isFollowUp: compose.isFollowUp,
      });
      await reload();
      setCompose({ templateId: '', subject: '', body: '', attachButtons: false, isFollowUp: false, cc: [] });
      setMissingVars([]); setError(undefined);
      setNotice(`已寄出。信件狀態轉為「${result.mailState === 'reminded' ? '已催覆' : '已寄出・等待回覆'}」，已寄信提醒已勾起。`);
    } catch (e) { setError(e instanceof Error ? e.message : '寄信失敗'); }
    finally { setSending(false); }
  };
  const favourites = useMemo(() => contacts.filter((contact) => contact.isFavorite && contact.primaryEmail), [contacts]);

  const currentSession = current ? sessionOf(current.registration) : undefined;
  /* 往來訊息直接讀 `listContacts()` 已經攤平好的 `messages`（依 sentAt 由舊到新）——
     這個面板不發任何請求。預設只渲染最後 5 封，最新的在最下面，接著就是下方的寄信面板。 */
  const mailMessages = current?.registration.messages ?? [];
  const mailVisible = mailExpanded ? mailMessages : mailMessages.slice(-5);
  const mailUnread = hasUnreadMail(current?.registration) && !mailRead;
  const preferred = current ? current.registration.answers?.preferredExactSlots : undefined;
  const preferredLabels = Array.isArray(preferred) ? preferred.filter((v): v is string => typeof v === 'string') : [];
  const answerEntries = Object.entries(answers);
  /** 標題順序：報名表定義 → ANSWER_LABEL（報名頁注入、不在 schema 裡的那兩個）→ key 本身。 */
  const labelOf = (key: string) => (current ? answerLabel(labelIndex, current.registration.projectId, key, ANSWER_LABEL) : key);
  // 這筆報名那條線的範本排最前——四條線的信混在一起時，最容易拿錯的就是隔壁線的同名信。
  const templateGroups = useMemo(() => groupTemplates(templates, projects, current?.registration.projectSlug), [templates, projects, current?.registration.projectSlug]);
  const rosterSession = sessions.find((session) => session.id === rosterSessionId);

  return <section className="ops-section">
    <SavingIndicator active={Boolean(busyId) || sending} />
    <PageHeader eyebrow="受理與審核" title="報名工作台" description="依專案分頁；表格內的狀態、勾選、時段可直接改，點姓名開詳情。" />
    {notice ? <OpsNotice tone="success">{notice}</OpsNotice> : null}{error ? <OpsNotice tone="danger">{error}</OpsNotice> : null}
    {/* 多佔名額的總覽。逐列的紅色標記要滑到才看得到，這一行是為了「一眼知道有沒有事要處理」。
        統計對象是這條服務線**未經篩選**的清單（`inTab`），不受上方篩選影響，不會出現
        「說有 3 筆、表上卻找不到」。同儕聚會一人多場是正常狀態，不是要收斂的問題，
        所以這條線的分頁不顯示這個橫幅——見 MULTI_SESSION_SLUGS。 */}
    {overHeld.count && !MULTI_SESSION_SLUGS.includes(activeTab.slug) ? <OpsNotice tone="warning">
      ⚠ 這條服務線有 <strong>{overHeld.count}</strong> 筆報名各自佔住多個時段，合計多佔了 <strong>{overHeld.extra}</strong> 個名額（<strong>不受上方篩選影響</strong>）。
      多佔的時段各自扣了一個名額；該場是否額滿要看該場自己的剩餘名額。請在「確定場次」欄的下拉選定實際錄取的那一場，多的會自動釋放。
    </OpsNotice> : null}
    {seatAudit.mismatch ? <OpsNotice tone="danger">
      ⚠ 名額對不上：場次記錄佔用 <strong>{seatAudit.booked}</strong> 個席次，但這條服務線看得到的報名只認領 <strong>{seatAudit.claimed}</strong> 個
      （差 {seatAudit.mismatch > 0 ? '+' : ''}{seatAudit.mismatch}）。
      {seatAudit.mismatch > 0
        ? '代表有席次的持有者不在這份清單裡——最常見的原因是那位聯絡人被封存了，報名會整個從工作台消失、名額卻還鎖著。'
        : '代表有報名宣稱佔著名額、場次那邊卻沒記到，通常是資料被直接改過。'}
    </OpsNotice> : null}
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

    {current && !rosterSessionId ? <><div className="ops-drawer-backdrop" onClick={() => setSelectedId(undefined)} />
      <aside className="ops-drawer">
        <header className="ops-drawer-head">
          <div><p className="ops-eyebrow">{current.registration.projectName}</p><h2>{current.contact.displayName || current.registration.email}</h2><p>{current.registration.email}</p></div>
          <button type="button" className="ops-link-button" onClick={() => setSelectedId(undefined)}>✕ 關閉</button>
        </header>
        <div className="ops-drawer-body">
          <article className="ops-panel">
            <div className="ops-button-row"><Link className="ops-link-button" to={`/admin/inbox?registration=${current.registration.id}`}>在收件匣開啟（草稿、批次、刪除在那裡）</Link><Link className="ops-link-button" to={`/admin/people?contact=${current.contact.id}`}>人物主檔</Link>{confirmingImport ? <><WarmButton onClick={() => void importHistory()}>確認匯入 {current.registration.email} 的全部往來</WarmButton><WarmButton variant="secondary" onClick={() => setConfirmingImport(false)}>取消</WarmButton></> : <WarmButton variant="secondary" onClick={() => setConfirmingImport(true)}>匯入這個人的歷史往來</WarmButton>}</div>
            <div className="ops-form-grid">
              <Select label="報名狀態" value={current.registration.status} onChange={(e) => void changeStatus(current.registration.id, e.target.value)}>{(STATUS_OPTIONS.includes(current.registration.status) ? STATUS_OPTIONS : [current.registration.status, ...STATUS_OPTIONS]).map((status) => <option value={status} key={status}>{STATUS_LABEL[status] ?? status}</option>)}</Select>
              <Select label="優先度" value={draft.priority ?? 'normal'} onChange={(e) => setDraft({ ...draft, priority: e.target.value as WorkPriority })}><option value="low">低</option><option value="normal">一般</option><option value="high">高</option><option value="urgent">緊急</option></Select>
              <TextInput type="datetime-local" label="下一步時間" value={draft.nextActionAt?.slice(0, 16) ?? ''} onChange={(e) => setDraft({ ...draft, nextActionAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
              <TextInput label="負責人 UUID" value={draft.assignedTo ?? ''} onChange={(e) => setDraft({ ...draft, assignedTo: e.target.value })} placeholder="可留空" />
            </div>
            <div className="ops-kv">
              <div><dt>✉ 信件狀態</dt><dd><MailStatusTag registration={current.registration} /><MailOverrideEditor registration={current.registration} onDone={async (message) => { await reload(); setNotice(message); }} onError={setError} /></dd></div>
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
              <small>這裡只寫入「最終確定時段」，不會順手建行事曆或 Meet。要建 Meet＋行事曆請到<Link to="/admin/sessions">場次管理</Link>，那裡是以場次為單位建立的。</small>
            </div> : null}
            <div className="ops-button-row"><WarmButton onClick={() => void saveAdmin()}>儲存行政欄位</WarmButton><WarmButton variant="secondary" onClick={() => void addTask()}>建立追蹤</WarmButton></div>
          </article>
          {/* 信件往來排在寄信面板正上方：看完對方說了什麼，往下就是回信的地方。
              不做成分頁——分頁會讓「往來」與「寄信」互相看不見，抽屜本來就是縱向捲動的面板堆疊。
              也不做原地回信：下方寄信面板有範本、變數與確認，`send-email-v2` 依 registrationId
              自動接同一條往來，「往來在上、回信在下」就是原地回信。 */}
          <article className="ops-panel">
            <div className="ops-panel-header">
              <div><h2>📨 信件往來</h2><p>這個人在這筆報名上的完整往來，最新的在最下面。</p></div>
              {mailUnread ? <StatusPill tone="coral">新信</StatusPill> : null}
            </div>
            {mailMessages.length ? <>
              <div className="ops-message-list">{mailVisible.map((message) => <article className={`ops-message ops-message--${message.direction}`} key={message.id}>
                <header><span><strong>{message.direction === 'inbound' ? message.from : `寄給 ${message.to}`}</strong><small>{message.subject}</small></span><small>{mailDate(message.sentAt)}</small></header>
                <p>{message.body || message.snippet || '（沒有可顯示的純文字內容）'}</p>
                {message.attachments.map((attachment) => <button type="button" className="ops-attachment" key={attachment.id} disabled={!attachment.storagePath} onClick={async () => { if (!attachment.storagePath) return; const url = await createEmailAttachmentUrl(attachment.storagePath); window.open(url, `_blank`, `noopener,noreferrer`); }}><Paperclip size={13} aria-hidden="true" /> {attachment.filename} · {mailBytes(attachment.sizeBytes)}</button>)}
              </article>)}</div>
              {mailMessages.length > mailVisible.length || mailExpanded
                ? <div className="ops-button-row"><button type="button" className="ops-link-button" onClick={() => setMailExpanded(!mailExpanded)}>{mailExpanded ? '只看最近 5 封' : `展開全部 ${mailMessages.length} 封`}</button></div>
                : null}
              <p className="ops-cell-muted">回信請用下方寄信面板，會接在同一條往來。</p>
            </> : <EmptyPanel title="還沒有信件往來" description="可用上方「匯入這個人的歷史往來」把舊信抓進來。" />}
          </article>
          <article className="ops-panel">
            <div className="ops-panel-header"><div><h2>✍️ 寄信</h2><p>選範本即帶入變數——你在這裡看到的字，就是實際會寄出的字。</p></div></div>
            <div className="ops-form-grid">
              <Select label="範本" value={compose.templateId} onChange={(e) => loadTemplate(e.target.value)}>
                <option value="">不套範本，自己寫</option>
                {templateGroups.map((group) => <optgroup key={group.label} label={group.label}>
                  {group.items.map((template) => <option key={template.id} value={template.id}>
                    {template.name}{template.reviewStatus === 'draft' ? '（待審閱）' : ''}
                  </option>)}
                </optgroup>)}
              </Select>
              <Select label="副本（常用聯絡人）" value={compose.cc[0] ?? ''} onChange={(e) => setCompose({ ...compose, cc: e.target.value ? [e.target.value] : [] })}>
                <option value="">無</option>
                {favourites.map((contact) => <option key={contact.id} value={contact.primaryEmail}>{contact.displayName}</option>)}
              </Select>
              <div className="ops-full"><TextInput label="主旨" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} /></div>
              <div className="ops-full"><Textarea label="內容" rows={10} value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} /></div>
            </div>
            {/* 可用變數就列在編輯框旁邊——寫範本的人不必去翻文件才知道打得出哪幾個。 */}
            <p className="ops-cell-muted">可用變數：{TEMPLATE_VARIABLES.map((name) => `{{${name}}}`).join('、')}</p>
            {missingVars.length ? <OpsNotice tone="warning">
              這些變數在這筆報名上沒有值，原樣留在文字裡沒有替換：<b>{missingVars.map((name) => `{{${name}}}`).join('、')}</b>。寄出前請自己補掉。
            </OpsNotice> : null}
            <label className="ops-inline-check">
              <input type="checkbox" checked={compose.attachButtons} onChange={(e) => setCompose({ ...compose, attachButtons: e.target.checked })} />
              信末自動附「✅ 我確認出席／🔁 我需要請假改期」兩個連結（對方一點，系統就記錄並更新狀態）
            </label>
            <label className="ops-inline-check">
              <input type="checkbox" checked={compose.isFollowUp} onChange={(e) => setCompose({ ...compose, isFollowUp: e.target.checked })} />
              這是催覆信（寄出後狀態轉「已催覆」，而非「等待回覆」）
            </label>
            <div className="ops-button-row">
              <WarmButton disabled={sending} onClick={() => void sendMail()}>{sending ? '寄送中…' : '寄出'}</WarmButton>
              <span className="ops-cell-muted">寄給 {current.registration.email}；寄出後自動勾起「已寄信提醒」並記錄稽核。</span>
            </div>
          </article>
          <article className="ops-panel"><div className="ops-panel-header"><div><h2>完整表單內容</h2><p>可補正缺漏資訊；所有欄位完整保留。</p></div></div>{answerEntries.length ? <div className="ops-form-grid">{answerEntries.map(([key, value]) => key === 'sessionIds'
            /* 場次唯讀。同一筆場次資料若有兩個編輯入口會互相打架：這一格改的只是 answers 的副本，
               名額不會跟著動；而「場次移轉」那條路走 admin_move_registration_sessions，
               才會把原場次與新場次的名額一起結清。值也不再是原始 UUID。 */
            ? <div className="ops-full" key={key}>
              <div className="ops-kv"><div><dt>{labelOf(key)}</dt><dd>{formatAnswerValue(key, value, sessionById) || '—'}</dd></div></div>
              <p className="ops-cell-muted">要改場次請用下方「場次移轉」。</p>
            </div>
            : <Textarea key={key} label={labelOf(key)} value={Array.isArray(value) ? value.map((v) => typeof v === 'string' ? v : JSON.stringify(v)).join('\n') : typeof value === 'string' ? value : JSON.stringify(value)} onChange={(e) => setAnswers({ ...answers, [key]: Array.isArray(value) ? e.target.value.split('\n').filter(Boolean) : e.target.value })} />)}</div> : <EmptyPanel title="這筆報名沒有表單內容" />}</article>
          <article className="ops-panel"><div className="ops-panel-header"><div><h2>場次移轉</h2>{
            /* 同儕聚會一人多場是正常狀態，不是要收斂的問題，這條線不顯示此警告——見 MULTI_SESSION_SLUGS。
               佔不佔名額要看 capacityReleasedAt：職場諮詢是申請制（seat_policy='on_confirm'），
               寫入當下就釋放名額，勾多個候選時段根本沒佔著，寫「佔住」是不實敘述。 */
            current.registration.sessionIds.length > 1 && !MULTI_SESSION_SLUGS.includes(current.registration.projectSlug ?? '')
              ? <p style={{ color: '#973d2c', fontWeight: 700 }}>
                {current.registration.capacityReleasedAt
                  ? `⚠ 這筆報名勾了 ${current.registration.sessionIds.length} 個候選時段（名額已釋放，未佔用）。確認要哪一場之後，請只勾那一場再送出。`
                  : `⚠ 這筆報名目前佔住 ${current.registration.sessionIds.length} 個時段，每一個都各扣了一個名額。確認要哪一場之後，請只勾那一場再送出，其餘會自動釋放。`}
              </p>
              : null
          }</div></div><div className="ops-list">{sessions.filter((s) => s.projectId === current.registration.projectId && ((draft.sessionIds ?? []).includes(s.id) || (s.status !== 'done' && s.status !== 'cancelled'))).map((session) => <div className="ops-list-row" key={session.id}><label><input type="checkbox" checked={(draft.sessionIds ?? []).includes(session.id)} onChange={() => toggleSession(session.id)} /> <strong>{new Date(session.startsAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</strong> {session.title}</label><span className="ops-list-meta"><small>{session.bookedCount}/{session.capacity}</small>{
            /* 只有勾起來的場次給入口：名冊回答的是「這一場實際有誰」，沒勾的對這筆報名只是候選。
               外層從 label 換成 div，是因為按鈕留在 label 內時，點它會順手把勾選切掉。 */
            (draft.sessionIds ?? []).includes(session.id)
              ? <button type="button" className="ops-link-button" onClick={() => { setSelectedId(undefined); setRosterSessionId(session.id); }}>這一場的名冊與寄信</button>
              : null
          }</span></div>)}</div><WarmButton onClick={() => void saveSessions()}>確認移轉場次</WarmButton></article>
          <article className="ops-panel"><div className="ops-panel-header"><h2>內部註記</h2></div><div className="ops-form-grid"><Select label="類型" value={noteType} onChange={(e) => setNoteType(e.target.value as typeof noteType)}><option value="general">一般</option><option value="eligibility">資格審核</option><option value="handoff">交接</option><option value="risk">風險</option></Select><div className="ops-full"><Textarea label="註記內容" rows={4} value={note} onChange={(e) => setNote(e.target.value)} /></div></div><WarmButton onClick={() => void addNote()}>新增註記</WarmButton>{notes.map((item) => <div className="ops-note" key={item.id}><p>{item.content}</p><small>{item.noteType} · 第 {item.revision} 版 · {new Date(item.createdAt).toLocaleString('zh-TW')}</small></div>)}</article>
          <article className="ops-panel"><div className="ops-panel-header"><div><h2>轉為持續服務個案</h2><p>保留原報名、人物、活動和信件關聯。</p></div></div><Textarea label="轉案摘要" value={caseSummary} onChange={(e) => setCaseSummary(e.target.value)} /><WarmButton onClick={() => void createCase()}>建立個案</WarmButton></article>
        </div>
      </aside></> : null}

    {/* 報名審核端的名冊入口。掛的是場次管理用的同一顆 SessionRosterPanel（同一個 import），
        資料全部來自本頁已載入的 state——零新查詢，面板自己也不查。 */}
    {rosterSession ? <><div className="ops-drawer-backdrop" onClick={() => setRosterSessionId(undefined)} />
      <aside className="ops-drawer">
        <header className="ops-drawer-head">
          <div>
            <p className="ops-eyebrow">場次名冊與寄信</p>
            <h2>{rosterSession.title}</h2>
            <p>{new Date(rosterSession.startsAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</p>
          </div>
          <button type="button" className="ops-link-button" onClick={() => setRosterSessionId(undefined)}>✕ 關閉</button>
        </header>
        <div className="ops-drawer-body"><article className="ops-panel">
          <SessionRosterPanel
            session={rosterSession}
            project={projects.find((project) => project.id === rosterSession.projectId)}
            roster={rosterOf(rosterSession.id)}
            sessions={sessions}
            schemas={schemas}
          />
        </article></div>
      </aside></> : null}
  </section>;
}

/**
 * 這筆報名有沒有沒看過的來信。
 *
 * `registrations.has_unread_reply` 是 core_schema 就有的欄位，但全庫沒有任何寫入者
 * （default false，gmail-sync 寫的是 email_threads.has_unread），只認它等於這個紅點
 * 永遠不會亮。所以同時看訊息本身的 `is_read`——那正是收件匣 `markThreadRead`／
 * `markThreadsHandled` 清的同一個欄位（都只動 inbound），兩處自然是同一套規則。
 * 兩個來源都是 `listContacts()` 已經載好的資料，不多打任何請求。
 */
function hasUnreadMail(registration?: OperationalRegistration) {
  if (!registration) return false;
  return Boolean(registration.hasUnreadReply) || (registration.messages ?? []).some((message) => message.direction === 'inbound' && !message.isRead);
}

/** 與 `InboxPage.tsx` 同一種寫法：往來訊息只需要月日時分，附件只需要人看得懂的大小。 */
function mailDate(value: string) { return new Date(value).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
function mailBytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1048576) return `${Math.round(value / 1024)} KB`; return `${(value / 1048576).toFixed(1)} MB`; }
