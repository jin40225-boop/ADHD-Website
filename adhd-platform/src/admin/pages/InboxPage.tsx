import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, RefreshCw, Save, Send } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { TextInput, Textarea, Select } from '@/components/ui/FormField/FormField';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { adminListEmailTemplates, invokeSendEmail } from '@/lib/api';
import { createEmailAttachmentUrl, getGmailSyncState, listInbox, markThreadRead, saveDraft } from '../operations/api';
import { syncGmailUntilDone, syncSummary } from '../operations/gmailSync';
import type { GmailSyncState, OperationalThread } from '../operations/types';
import { EmptyPanel, InlineSpinner, OpsNotice, PageHeader, StatusPill } from '../operations/components';

export default function InboxPage() {
  const [searchParams] = useSearchParams();
  const [threads, setThreads] = useState<OperationalThread[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [syncState, setSyncState] = useState<GmailSyncState | null>(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    try {
      const [nextThreads, nextSync] = await Promise.all([listInbox(), getGmailSyncState()]);
      setThreads(nextThreads); setSyncState(nextSync);
      setSelectedId((current) => current && nextThreads.some((item) => item.id === current) ? current : nextThreads[0]?.id);
      setError(undefined);
    } catch (err) { setError(err instanceof Error ? err.message : '讀取收件匣失敗'); }
    finally { setLoading(false); }
  }, []);
  // 離開頁面就讓同步迴圈停在這一批，不要在背景繼續打。
  const left = useRef(false);
  useEffect(() => () => { left.current = true; }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const threadId = searchParams.get('thread');
    const registrationId = searchParams.get('registration');
    const requested = threads.find((item) => item.id === threadId || item.registrationId === registrationId);
    if (requested) setSelectedId(requested.id);
  }, [searchParams, threads]);
  const selected = threads.find((thread) => thread.id === selectedId);
  useEffect(() => { if (selected?.hasUnread) void markThreadRead(selected.id).then(reload).catch(() => undefined); }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => threads.filter((thread) => {
    const matchesFilter = filter === 'all' || (filter === 'unread' && thread.hasUnread) || (filter === 'reply' && thread.needsReply) || (filter === 'unlinked' && !thread.registrationId) || thread.status === filter;
    const haystack = `${thread.subject} ${thread.counterpartEmail} ${thread.messages.map((message) => `${message.subject} ${message.body}`).join(' ')}`.toLowerCase();
    return matchesFilter && (!query.trim() || haystack.includes(query.trim().toLowerCase()));
  }), [filter, query, threads]);

  async function handleSync(full = false) {
    setSyncing(true); setNotice(undefined); setError(undefined);
    /* 這顆按鈕先前只送一次請求，所以每按一次只前進一批（5 封）——佇列 113 封要按 23 次，
     * 而分批之後「按一次就同步完」的迴圈當時只加在整合設定那顆。兩顆按鈕做同一件事，
     * 現在走同一段程式。 */
    try {
      const outcome = await syncGmailUntilDone(full, (progress) => {
        setNotice(`Gmail 同步中…第 ${progress.rounds} 批，已收進 ${progress.synced} 封${progress.remaining ? `，還有 ${progress.remaining} 封排隊中` : ''}。`);
      }, () => left.current);
      await reload();
      if (outcome.stopped) setError(`${syncSummary(outcome)}（第 ${outcome.rounds + 1} 批中止：${outcome.stopped}。已完成的部分都已存檔，再按一次會從剩下的接著做。）`);
      else setNotice(syncSummary(outcome));
    }
    catch (err) { setError(err instanceof Error ? err.message : 'Gmail 同步失敗'); }
    finally { setSyncing(false); }
  }

  return <div><PageHeader eyebrow="Unified Communications" title="整合收件匣" description="收信、回覆、草稿、範本與完整往來集中在同一個工作台；未關聯郵件可再連回人員或報名。" actions={<><WarmButton size="sm" variant="secondary" icon={RefreshCw} onClick={() => void handleSync(false)} disabled={syncing}>{syncing ? '同步中…' : '同步 Gmail'}</WarmButton></>} />
    {syncState ? <OpsNotice tone={syncState.lastError ? 'warning' : 'info'}>信箱：{syncState.mailboxEmail}　·　最後同步：{syncState.lastIncrementalSyncAt || syncState.lastFullSyncAt ? formatDate(syncState.lastIncrementalSyncAt || syncState.lastFullSyncAt!) : '尚未同步'}{syncState.lastError ? `　·　最近錯誤：${syncState.lastError}` : ''}</OpsNotice> : <OpsNotice tone="warning">Gmail 尚未完成首次收信同步；可先按「同步 Gmail」建立狀態。</OpsNotice>}
    {notice ? <OpsNotice tone="success" role="status">{notice}</OpsNotice> : null}{error ? <OpsNotice tone="danger" role="alert">{error}</OpsNotice> : null}
    <div className="ops-toolbar"><div className="ops-search"><TextInput label="搜尋信件" name="inbox-search" value={query} placeholder="寄件者、主旨或內容" onChange={(e) => setQuery(e.target.value)} /></div><Select label="收件匣檢視" name="inbox-filter" value={filter} onChange={(e) => setFilter(e.target.value)} options={[{ value: 'all', label: '全部對話' }, { value: 'unread', label: '未讀' }, { value: 'reply', label: '待回覆' }, { value: 'waiting', label: '等待對方' }, { value: 'closed', label: '已處理' }, { value: 'unlinked', label: '未關聯人員' }]} /></div>
    {loading ? <InlineSpinner label="同步信件索引…" /> : <div className="ops-inbox"><section className="ops-panel ops-panel--flush"><div className="ops-thread-list" style={{ padding: '.8rem' }}>{filtered.map((thread) => <button key={thread.id} type="button" onClick={() => setSelectedId(thread.id)} className={`ops-list-button ${thread.id === selected?.id ? 'ops-list-button--active' : ''}`}><div className="ops-list-row"><span><strong>{thread.subject || '（無主旨）'}</strong><small>{thread.counterpartEmail}</small></span>{thread.hasUnread ? <StatusPill tone="coral">新信</StatusPill> : null}</div><small>{thread.messages.at(-1)?.snippet || thread.messages.at(-1)?.body.slice(0, 70) || '尚無信件內容'}</small><div className="ops-list-meta">{thread.needsReply ? <StatusPill tone="yellow">待回覆</StatusPill> : null}{!thread.registrationId ? <StatusPill tone="red">未關聯</StatusPill> : null}<StatusPill>{thread.messages.length} 封</StatusPill></div></button>)}{!filtered.length ? <EmptyPanel title="這個檢視沒有信件" /> : null}</div></section><section className="ops-panel">{selected ? <ThreadDetail thread={selected} onSent={async () => { setNotice('信件已寄出並保留在往來紀錄。'); await reload(); }} onError={setError} /> : <EmptyPanel title="請選擇一個對話" description="左側會列出已同步的收件與寄件對話。" />}</section></div>}
  </div>;
}

function ThreadDetail({ thread, onSent, onError }: { thread: OperationalThread; onSent: () => Promise<void>; onError: (message: string) => void }) {
  const [templates, setTemplates] = useState<{ id: string; name: string; subject: string; body: string }[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState(thread.subject || '');
  const [body, setBody] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [draftId, setDraftId] = useState<string>();
  const [draftState, setDraftState] = useState('尚未儲存');
  const [sending, setSending] = useState(false);
  const saveTimer = useRef<number>();
  useEffect(() => { void adminListEmailTemplates().then(setTemplates).catch(() => setTemplates([])); }, []);
  useEffect(() => { setSubject(thread.subject || ''); setBody(''); setCc(''); setBcc(''); setDraftId(undefined); setDraftState('尚未儲存'); }, [thread.id, thread.subject]);

  async function persistDraft() {
    if (!thread.registrationId || (!subject.trim() && !body.trim())) return;
    setDraftState('儲存中…');
    try { const id = await saveDraft({ id: draftId, registrationId: thread.registrationId, threadId: thread.id, toEmail: thread.counterpartEmail, cc: splitEmails(cc), bcc: splitEmails(bcc), subject, body }); setDraftId(id); setDraftState(`草稿已儲存 ${new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`); }
    catch (err) { setDraftState('草稿儲存失敗'); onError(err instanceof Error ? err.message : '草稿儲存失敗'); }
  }
  function scheduleDraft() { window.clearTimeout(saveTimer.current); saveTimer.current = window.setTimeout(() => void persistDraft(), 1200); }
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);
  function applyTemplate(id: string) { setTemplateId(id); const template = templates.find((item) => item.id === id); if (template) { setSubject(template.subject); setBody(template.body); queueMicrotask(scheduleDraft); } }
  async function sendMessage() {
    if (!thread.registrationId || !subject.trim() || !body.trim()) return;
    setSending(true); onError('');
    try { await persistDraft(); await invokeSendEmail({ registrationId: thread.registrationId, subject, body, cc: splitEmails(cc), bcc: splitEmails(bcc), threadId: thread.id }); setBody(''); setCc(''); setBcc(''); setDraftState('已寄出'); await onSent(); }
    catch (err) { onError(err instanceof Error ? err.message : '寄信失敗'); }
    finally { setSending(false); }
  }
  return <><div className="ops-detail-header"><div><h2>{thread.subject || '（無主旨）'}</h2><p>{thread.counterpartEmail}　·　{thread.messages.length} 封往來</p></div><StatusPill tone={thread.needsReply ? 'yellow' : thread.status === 'closed' ? 'green' : 'blue'}>{thread.needsReply ? '待回覆' : thread.status === 'closed' ? '已處理' : '進行中'}</StatusPill></div><div className="ops-message-list">{thread.messages.map((message) => <article className={`ops-message ops-message--${message.direction}`} key={message.id}><header><span><strong>{message.direction === 'inbound' ? message.from : `寄給 ${message.to}`}</strong><small>{message.subject}</small></span><small>{formatDate(message.sentAt)}</small></header><p>{message.body || message.snippet || '（沒有可顯示的純文字內容）'}</p>{message.attachments.map((attachment) => <button type="button" className="ops-attachment" key={attachment.id} disabled={!attachment.storagePath} onClick={async () => { if (!attachment.storagePath) return; const url = await createEmailAttachmentUrl(attachment.storagePath); window.open(url, `_blank`, `noopener,noreferrer`); }}><Paperclip size={13} aria-hidden="true" /> {attachment.filename} · {formatBytes(attachment.sizeBytes)}</button>)}</article>)}</div>{thread.registrationId ? <section className="ops-compose"><div className="ops-form-grid"><Select label="套用範本" name="compose-template" value={templateId} onChange={(e) => applyTemplate(e.target.value)} options={[{ value: '', label: '不使用範本' }, ...templates.map((template) => ({ value: template.id, label: template.name }))]} /><TextInput label="收件者" name="compose-to" value={thread.counterpartEmail} readOnly /><div className="ops-full"><TextInput label="主旨" name="compose-subject" value={subject} onChange={(e) => { setSubject(e.target.value); scheduleDraft(); }} /></div><TextInput label="副本 CC" name="compose-cc" value={cc} placeholder="多個地址以逗號分隔" onChange={(e) => { setCc(e.target.value); scheduleDraft(); }} /><TextInput label="密件 BCC" name="compose-bcc" value={bcc} onChange={(e) => { setBcc(e.target.value); scheduleDraft(); }} /><div className="ops-full"><Textarea label="信件內容" name="compose-body" rows={8} value={body} onChange={(e) => { setBody(e.target.value); scheduleDraft(); }} helpText="範本只會帶入初稿；寄出前可自由編輯，所有草稿修改會保留版本。" /></div></div><div className="ops-compose-actions"><span className="ops-draft-state">{draftState}</span><WarmButton size="sm" variant="secondary" icon={Save} onClick={() => void persistDraft()}>儲存草稿</WarmButton><WarmButton size="sm" icon={Send} onClick={() => void sendMessage()} disabled={sending || !subject.trim() || !body.trim()}>{sending ? '寄送中…' : '寄出回覆'}</WarmButton></div></section> : <OpsNotice tone="warning">這封信尚未關聯報名資料。完成 Gmail 同步配對或從人員主檔連結後即可回覆。</OpsNotice>}</>;
}

function splitEmails(value: string) { return value.split(/[;,，；]/).map((item) => item.trim()).filter(Boolean); }
function formatDate(value: string) { return new Date(value).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
function formatBytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1048576) return `${Math.round(value / 1024)} KB`; return `${(value / 1048576).toFixed(1)} MB`; }



