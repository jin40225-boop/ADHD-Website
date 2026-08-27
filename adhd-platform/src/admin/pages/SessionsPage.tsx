/**
 * 場次管理（03_v4）。列表內直接改名額與截止、用 toggle 上下架；點服務線開場次詳情，
 * 詳情裡編輯主題與客座（＝「公布神秘驚喜」的操作入口）、導航的候選時段，並建 Meet／行事曆。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FormSchema, Project, SessionAttachment, SessionSlot, SessionStatus } from '@contracts/types';
import { CheckboxGroup, TextInput, Textarea, Select } from '@/components/ui/FormField/FormField';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { adminListFormSchemas, adminListProjects, adminListSessions, adminSaveSession, invokeCalendarUpsert } from '@/lib/api';
import { isSupabaseReady } from '@/lib/supabase';
import DemoDataNotice from '../DemoDataNotice';
import { listActivities, listContacts } from '../operations/api';
import type { ActivityRecord, ContactRecord } from '../operations/types';
import { EmptyPanel, InlineSpinner, OpsNotice, PageHeader, SavingIndicator } from '../operations/components';
import { SessionRosterPanel } from '../operations/SessionRosterDrawer';
import { toLocalInput } from '../operations/RegistrationTable';
import { SESSION_STATUS_TEXT as STATUS_TEXT, SessionTable, sessionDateText as dateText, sessionTimeText as timeText } from '../operations/SessionTable';

function toIso(value: string) { return value ? new Date(value).toISOString() : ''; }

/**
 * 延伸連結：後台用「一行一筆：標籤 | 網址」的純文字編輯，存檔時轉成 jsonb。
 *
 * 為什麼是純文字而不是一組動態表列：這一欄一個月大概被編輯一次，內容通常從月度的
 * 「活動內容整理」文件貼過來。純文字貼上即可，動態表列反而要一格一格填。
 *
 * 沒有網址的行直接略過（只有標籤的連結按不動，等於裝飾品）；標籤留空就拿網址當標籤，
 * 前台才不會出現一個沒有文字的連結。網址本身可能含 `|`（查詢字串），所以第一個
 * `|` 之後全部算網址，不是 split 完取第二段。
 */
function parseAttachments(text: string): SessionAttachment[] {
  return text.split('\n').map((line) => {
    const divider = line.indexOf('|');
    const label = divider === -1 ? '' : line.slice(0, divider).trim();
    const url = (divider === -1 ? line : line.slice(divider + 1)).trim();
    return { label: label || url, url, kind: 'link' as const };
  }).filter((item) => item.url !== '');
}

function attachmentsToText(items?: SessionAttachment[]): string {
  return (items ?? []).map((item) => `${item.label} | ${item.url}`).join('\n');
}

export default function SessionsPage() {
  const live = isSupabaseReady;
  const [sessions, setSessions] = useState<SessionSlot[]>([]); const [projects, setProjects] = useState<Project[]>([]); const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  /** 報名表定義：名冊面板拿它把答案的 key 換回家長當初看到的問法。 */
  const [schemas, setSchemas] = useState<Record<string, FormSchema>>({});
  const [projectFilter, setProjectFilter] = useState('all'); const [selectedId, setSelectedId] = useState<string>(); const [busyId, setBusyId] = useState<string>();
  const [loading, setLoading] = useState(live); const [notice, setNotice] = useState<string>(); const [error, setError] = useState<string>();
  const [draft, setDraft] = useState<SessionSlot>();
  /** 延伸連結的純文字編輯緩衝。不即時 parse 回 draft：打到一半的行（還沒打上網址）
   *  會被 parse 丟掉，游標就跳掉了。存檔那一刻才轉成 jsonb。 */
  const [attachmentsText, setAttachmentsText] = useState('');

  const reload = useCallback(async () => {
    if (!live) return;
    const [nextSessions, nextProjects, nextContacts, nextActivities, nextSchemas] = await Promise.all([adminListSessions(), adminListProjects(), listContacts(), listActivities(), adminListFormSchemas()]);
    setSessions(nextSessions); setProjects(nextProjects); setContacts(nextContacts); setActivities(nextActivities); setSchemas(nextSchemas);
  }, [live]);
  useEffect(() => { reload().catch((e: unknown) => setError(e instanceof Error ? e.message : '載入場次失敗')).finally(() => setLoading(false)); }, [reload]);

  const projectName = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const current = sessions.find((session) => session.id === selectedId);
  useEffect(() => { setDraft(current ? { ...current } : undefined); setAttachmentsText(attachmentsToText(current?.attachments)); }, [selectedId, sessions]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => sessions.filter((session) => projectFilter === 'all' || session.projectId === projectFilter), [sessions, projectFilter]);
  /**
   * 這個場次的服務線是不是申請制。只有申請制（on_confirm）支援「額滿後仍收候補」——
   * 先到先得允許一人報多場，而名額旗標 `capacity_released_at` 是每筆報名一個，
   * 表達不了「A 場佔位、B 場候補」（見 20260827000044）。所以那條線的開關是停用的，
   * 而且必須把原因寫在畫面上：停用而不說原因，下一個人只會以為是壞掉了。
   */
  const waitlistSupported = projects.find((project) => project.id === draft?.projectId)?.seatPolicy === 'on_confirm';
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
    <SavingIndicator active={Boolean(busyId)} />
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
      onReject: (_session, reason) => { setError(reason); setNotice(undefined); },
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
              {/* 所屬活動：`activity_id` 早就存在、adminSaveSession 也一直有送，
                  但直到現在都沒有任何 UI 可以設定它——協辦活動專欄要靠它把場次掛到
                  合作案底下，沒有這個選單就是「欄位在、路不通」。只列同一個計畫的活動。 */}
              <div className="ops-full"><Select label="所屬活動（協辦活動必填）" value={draft.activityId ?? ''} onChange={(e) => setDraft({ ...draft, activityId: e.target.value || undefined })}>
                <option value="">（不掛活動）</option>
                {activities.filter((a) => a.projectId === draft.projectId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select></div>
              {/* 額滿之後還收不收，改成每個場次自己決定（2026-08-27 裁決）。
                  先到先得的服務線停用這個開關並明說原因——「不做假功能」：能勾但沒有效果，
                  比不能勾更糟，因為前台會照著它喊出一個資料庫其實會擋下的承諾。 */}
              <div className="ops-full"><CheckboxGroup
                label="額滿後的報名"
                name="session-allow-waitlist"
                options={[{ label: '額滿後仍接受候補報名', value: 'on', disabled: !waitlistSupported }]}
                value={draft.allowWaitlist ? ['on'] : []}
                onChange={(values) => setDraft({ ...draft, allowWaitlist: values.includes('on') })}
                helpText={waitlistSupported
                  ? '勾選後，額滿仍收得到報名，但這筆不佔名額（候補）。已結束／已取消／未上架的場次一律不收，與本設定無關。'
                  : '先到先得的服務線暫不支援候補——一人可報多場，而名額旗標是每筆報名一個，表達不了「A 場佔位、B 場候補」。'}
              /></div>
            </div>
            <div className="ops-panel-header" style={{ marginTop: '1rem' }}><div><h2>公布主題與客座</h2><p>主題與客座留空時，前台顯示「神秘驚喜！」——填了就等於公布。介紹段落與延伸連結留空則整塊不顯示。</p></div></div>
            <div className="ops-form-grid">
              <TextInput label="本場主題" value={draft.topic ?? ''} placeholder="留空＝神秘驚喜！" onChange={(e) => setDraft({ ...draft, topic: e.target.value })} />
              <TextInput label="客座來賓" value={draft.guest ?? ''} placeholder="留空＝神秘驚喜！" onChange={(e) => setDraft({ ...draft, guest: e.target.value })} />
              <div className="ops-full"><Textarea label="場次介紹（我們聊什麼）" value={draft.description ?? ''} rows={3} placeholder="留空＝前台不顯示介紹段" onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
              {/* 延伸連結：來賓連結是固定語意的一列（前台顯示「認識來賓 ↗」），
                  其餘附件走下面的純文字。兩個都空時前台整塊不出現。
                  這一輪只做連結型——檔案上傳需要 Storage bucket 與權限設計，不在本包。 */}
              <div className="ops-full"><TextInput label="認識來賓的連結" name="session-guest-url" value={draft.guestUrl ?? ''} placeholder="https://…（留空＝前台不顯示「認識來賓」）" onChange={(e) => setDraft({ ...draft, guestUrl: e.target.value })} /></div>
              <div className="ops-full"><Textarea label="延伸連結／附件（一行一筆：標籤 | 網址）" name="session-attachments" value={attachmentsText} rows={3} placeholder={'活動內容整理 | https://…\n報導連結 | https://…'} helpText="沒有網址的行會被略過；標籤留空就用網址當顯示文字。目前只支援連結，尚未提供檔案上傳。" onChange={(e) => setAttachmentsText(e.target.value)} /></div>
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
              <WarmButton onClick={() => void save(current, { ...draft, attachments: parseAttachments(attachmentsText) }, '場次已儲存，前台即時更新。')}>儲存場次</WarmButton>
              <WarmButton variant="secondary" onClick={() => void createCalendar(current)}>建立 Meet＋行事曆</WarmButton>
            </div>
            {current.meetUrl ? <p className="ops-cell-muted">目前 Meet：{current.meetUrl}</p> : null}
          </article>

          <article className="ops-panel">
            {/*
              已結束的場次要顯示「名冊 N 人」而不是「已報名 0／名額 100」。
              歷史報名回填時刻意不補 booked_count（場次已結束，名額不再被佔用，而後台的
              兩個名額警告都只統計未釋額的列，補了反而讓它們誤報）。於是舊場次會出現
              「0／100」配一份十幾人的名冊——**那個 0 是對的**，但它看起來像壞掉的數字，
              而看起來壞掉的數字會被人「修好」：協辦活動當初就是靠 capacity=0 當防線，
              被人改成 50／100 之後防線就消失了（見 20260810000038）。這裡直接不顯示
              那個會誘人動手的數字。
            */}
            <div className="ops-panel-header"><div><h2>報名概況</h2><p>
              {current.status === 'done' || current.status === 'cancelled'
                ? `名冊 ${rosterOf(current.id).length} 人（場次已結束，不再佔用名額）`
                : `已報名 ${current.bookedCount}／名額 ${current.capacity}`}
            </p></div></div>
            <SessionRosterPanel
              session={current}
              project={projects.find((project) => project.id === current.projectId)}
              roster={rosterOf(current.id)}
              sessions={sessions}
              schemas={schemas}
            />
          </article>

          <article className="ops-panel">
            <div className="ops-panel-header"><div><h2>行政文件區</h2><p>依本場次現況產生講師行前通知、客座邀請等文件。</p></div></div>
            <OpsNotice tone="info">文件生成已啟用。產出入口在<Link to="/admin/documents">文件產生中心</Link>，可依這個場次的現況產生講師行前通知、客座邀請等草稿。</OpsNotice>
            {/* 這個 panel 原本只有一段說明文字，讀完還是得自己從側欄找路。兩個連結直接把
                「產出文件」與「改範本」接上——講師行前通知的內容素材在上面的「彙整」分頁複製。 */}
            <div className="ops-button-row">
              <Link className="ui-button ui-button--primary ui-button--sm" to={`/admin/documents?session=${current.id}`}>開文件產生中心（帶本場次）</Link>
              <Link className="ui-button ui-button--secondary ui-button--sm" to="/admin/templates">編輯信件與文件範本</Link>
            </div>
          </article>
        </div>
      </aside></> : null}
  </section>;
}
