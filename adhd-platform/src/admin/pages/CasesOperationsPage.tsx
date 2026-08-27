import { useEffect, useMemo, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminListProjects } from '@/lib/api';
import type { Project } from '@contracts/types';
import { TextInput, Textarea, Select } from '@/components/ui/FormField/FormField';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { archiveOperationalCase, archiveServiceRecord, listOperationalCases, saveOperationalCase, saveServiceRecord, transferCase, type OperationalCase } from '../operations/case-api';
import { createEmailAttachmentUrl, listCaseMail, listNotes, listTeamMembers, saveNote, saveTask, type CaseMailThread } from '../operations/api';
import type { InternalNote, TeamMemberRecord } from '../operations/types';
import { EmptyPanel, InlineSpinner, OpsNotice, PageHeader, StatusPill } from '../operations/components';

export default function CasesOperationsPage() {
  const [items, setItems] = useState<OperationalCase[]>([]); const [projects, setProjects] = useState<Project[]>([]); const [team, setTeam] = useState<TeamMemberRecord[]>([]); const [selectedId, setSelectedId] = useState<string>(); const [notes, setNotes] = useState<InternalNote[]>([]); const [search, setSearch] = useState(''); const [loading, setLoading] = useState(true); const [notice, setNotice] = useState<string>(); const [error, setError] = useState<string>();
  const selected = items.find((item) => item.id === selectedId);
  const [caseDraft, setCaseDraft] = useState<Partial<OperationalCase>>({}); const [record, setRecord] = useState<{ kind: 'service' | 'contact' | 'note'; title: string; content: string; occurredAt: string }>({ kind: 'service', title: '', content: '', occurredAt: new Date().toISOString().slice(0, 16) }); const [note, setNote] = useState(''); const [transfer, setTransfer] = useState({ to: '', reason: '' });
  const [confirmingArchive, setConfirmingArchive] = useState(false); const [confirmingRecordId, setConfirmingRecordId] = useState<string>();
  const reload = async () => { const [cases, ps, members] = await Promise.all([listOperationalCases(), adminListProjects(), listTeamMembers()]); setItems(cases); setProjects(ps); setTeam(members.filter((m) => ['owner', 'admin_collab'].includes(m.role))); if (!selectedId && cases[0]) setSelectedId(cases[0].id); };
  useEffect(() => { reload().catch((e: unknown) => setError(e instanceof Error ? e.message : '讀取個案失敗')).finally(() => setLoading(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // 換個案時把兩段式確認收回來：否則按了「封存」再切到別的個案，按鈕已經停在「確定要封存」上。
  useEffect(() => { setConfirmingArchive(false); setConfirmingRecordId(undefined); if (selected) { setCaseDraft({ ...selected }); listNotes({ caseId: selected.id }).then(setNotes).catch(() => setNotes([])); } }, [selectedId, items]); // eslint-disable-line react-hooks/exhaustive-deps
  /**
   * 這個個案關聯的人的信件往來。**只在選中個案且有 contactId 時才撈**，撈的是瘦查詢
   * `listCaseMail`，不是報名工作台那顆全站重物件。沒有關聯聯絡人就整段不查。
   */
  const [mail, setMail] = useState<CaseMailThread[]>([]);
  useEffect(() => {
    setMail([]);
    const contactId = selected?.contactId;
    if (!contactId) return;
    let left = false;
    listCaseMail(contactId).then((rows) => { if (!left) setMail(rows); }).catch(() => { if (!left) setMail([]); });
    return () => { left = true; };
  }, [selected?.contactId]);
  const filtered = useMemo(() => items.filter((item) => `${item.displayName} ${item.summary ?? ''}`.toLowerCase().includes(search.toLowerCase())), [items, search]);
  const saveCase = async () => { if (!caseDraft.projectId || !caseDraft.displayName) { setError('請填寫計畫與個案名稱。'); return; } try { await saveOperationalCase({ ...caseDraft, projectId: caseDraft.projectId, displayName: caseDraft.displayName, serviceType: caseDraft.serviceType ?? 'ongoing', status: caseDraft.status ?? 'active' }); await reload(); setNotice('個案資料已儲存。'); } catch (e) { setError(e instanceof Error ? e.message : '儲存個案失敗'); } };
  const addRecord = async () => { if (!selected || !record.title.trim()) return; try { await saveServiceRecord({ caseId: selected.id, ...record, occurredAt: new Date(record.occurredAt).toISOString() }); setRecord({ kind: 'service', title: '', content: '', occurredAt: new Date().toISOString().slice(0, 16) }); await reload(); setNotice('服務紀錄已新增。'); } catch (e) { setError(e instanceof Error ? e.message : '新增紀錄失敗'); } };
  const addNote = async () => { if (!selected || !note.trim()) return; try { await saveNote({ caseId: selected.id, noteType: 'general', content: note }); setNote(''); setNotes(await listNotes({ caseId: selected.id })); setNotice('內部註記已儲存。'); } catch (e) { setError(e instanceof Error ? e.message : '儲存註記失敗'); } };
  const addTask = async () => { if (!selected) return; try { await saveTask({ projectId: selected.projectId, caseId: selected.id, contactId: selected.contactId, title: `追蹤：${selected.displayName}`, priority: 'normal', status: 'open' }); setNotice('已建立追蹤待辦。'); } catch (e) { setError(e instanceof Error ? e.message : '建立追蹤待辦失敗'); } };
  const doTransfer = async () => { if (!selected || !transfer.to || !transfer.reason.trim()) { setError('請選擇接手者並填寫轉移原因。'); return; } try { await transferCase(selected.id, selected.assignedTo, transfer.to, transfer.reason); setTransfer({ to: '', reason: '' }); await reload(); setNotice('個案已轉移並留下紀錄。'); } catch (e) { setError(e instanceof Error ? e.message : '個案轉移失敗'); } };
  const createNew = () => { setSelectedId(undefined); setCaseDraft({ projectId: projects[0]?.id, displayName: '', serviceType: 'ongoing', status: 'active' }); };
  return <section className="ops-section"><PageHeader eyebrow="持續服務" title="個案管理" description="建立、編輯、轉移、結案與保存具版本歷程的服務紀錄。" actions={<WarmButton onClick={createNew}>＋ 建立個案</WarmButton>} />{notice ? <OpsNotice tone="success">{notice}</OpsNotice> : null}{error ? <OpsNotice tone="danger">{error}</OpsNotice> : null}{loading ? <InlineSpinner /> : <div className="ops-split">
    <aside className="ops-panel ops-panel--flush"><div className="ops-search"><TextInput label="搜尋個案" value={search} onChange={(e) => setSearch(e.target.value)} /></div>{filtered.length ? <div className="ops-list">{filtered.map((item) => <button type="button" key={item.id} className={`ops-list-button ${item.id === selectedId ? 'ops-list-button--active' : ''}`} onClick={() => setSelectedId(item.id)}><div><strong>{item.displayName}</strong><p>{item.summary || '尚無摘要'}</p></div><StatusPill tone={item.status === 'active' ? 'green' : item.status === 'closed' ? 'gray' : 'yellow'}>{item.status}</StatusPill></button>)}</div> : <EmptyPanel title="沒有個案" />}</aside>
    <main className="ops-section"><article className="ops-panel"><div className="ops-panel-header"><h2>{caseDraft.id ? caseDraft.displayName : '建立新個案'}</h2>{caseDraft.id ? <StatusPill tone={caseDraft.status === 'active' ? 'green' : 'gray'}>{caseDraft.status}</StatusPill> : null}</div><div className="ops-form-grid"><Select label="所屬計畫" value={caseDraft.projectId ?? ''} onChange={(e) => setCaseDraft({ ...caseDraft, projectId: e.target.value })}>{projects.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</Select><TextInput label="個案顯示名稱" value={caseDraft.displayName ?? ''} onChange={(e) => setCaseDraft({ ...caseDraft, displayName: e.target.value })} /><Select label="服務型態" value={caseDraft.serviceType ?? 'ongoing'} onChange={(e) => setCaseDraft({ ...caseDraft, serviceType: e.target.value as OperationalCase['serviceType'] })}><option value="ongoing">持續服務</option><option value="single">單次服務</option></Select><Select label="狀態" value={caseDraft.status ?? 'active'} onChange={(e) => setCaseDraft({ ...caseDraft, status: e.target.value as OperationalCase['status'] })}><option value="active">進行中</option><option value="paused">暫停</option><option value="closed">結案</option></Select><div className="ops-full"><Textarea label="個案摘要" rows={4} value={caseDraft.summary ?? ''} onChange={(e) => setCaseDraft({ ...caseDraft, summary: e.target.value })} /></div>{caseDraft.status === 'closed' ? <div className="ops-full"><Textarea label="結案原因" value={caseDraft.closeReason ?? ''} onChange={(e) => setCaseDraft({ ...caseDraft, closeReason: e.target.value })} /></div> : null}</div><div className="ops-button-row"><WarmButton onClick={() => void saveCase()}>儲存個案</WarmButton>{selected ? <><WarmButton variant="secondary" onClick={() => void addTask()}>建立追蹤</WarmButton>{confirmingArchive
      ? <><WarmButton variant="secondary" onClick={() => { setConfirmingArchive(false); void archiveOperationalCase(selected.id).then(reload).catch((e: unknown) => setError(e instanceof Error ? e.message : '封存個案失敗')); }}>確定要封存「{selected.displayName}」？</WarmButton><WarmButton variant="secondary" onClick={() => setConfirmingArchive(false)}>取消</WarmButton></>
      : <WarmButton variant="secondary" onClick={() => setConfirmingArchive(true)}>封存</WarmButton>}</> : null}</div></article>
    {selected ? <>{/* 信件往來（唯讀）。個案台不寄信——範本變數、催覆語意與 mail-state 全掛在報名脈絡上，
      在這裡再開一個寄信面板等於第三個要同步維護的表面。也不清未讀：唯讀檢視不該動狀態，
      清除留給收件匣與報名抽屜這兩個真的在「處理信」的地方。 */}
    <article className="ops-panel"><div className="ops-panel-header"><div><h2>📨 信件往來</h2><p>唯讀檢視；回信、清未讀請用下方連結跳到收件匣或報名詳情。</p></div></div>{!selected.contactId
      ? <EmptyPanel title="這個個案沒有關聯聯絡人，沒有可顯示的信件往來" description="把個案接回人物主檔之後，這裡就會顯示這個人的往來。" />
      : mail.length
        ? <div className="ops-section">{mail.map((thread) => <div key={thread.threadId}>
          <div className="ops-list-meta">{thread.hasUnread ? <StatusPill tone="coral">新信</StatusPill> : null}<StatusPill>{thread.messages.length} 封</StatusPill></div>
          <div className="ops-message-list">{thread.messages.map((message) => <article className={`ops-message ops-message--${message.direction}`} key={message.id}>
            <header><span><strong>{message.direction === 'inbound' ? message.from : `寄給 ${message.to}`}</strong><small>{message.subject}</small></span><small>{mailDate(message.sentAt)}</small></header>
            <p>{message.body || message.snippet || '（沒有可顯示的純文字內容）'}</p>
            {message.attachments.map((attachment) => <button type="button" className="ops-attachment" key={attachment.id} disabled={!attachment.storagePath} onClick={async () => { if (!attachment.storagePath) return; const url = await createEmailAttachmentUrl(attachment.storagePath); window.open(url, `_blank`, `noopener,noreferrer`); }}><Paperclip size={13} aria-hidden="true" /> {attachment.filename} · {mailBytes(attachment.sizeBytes)}</button>)}
          </article>)}</div>
          <div className="ops-button-row"><Link className="ops-link-button" to={`/admin/inbox?registration=${thread.registrationId}`}>到收件匣回信</Link><Link className="ops-link-button" to={`/admin/registrations?registration=${thread.registrationId}`}>開報名詳情</Link></div>
        </div>)}</div>
        : <EmptyPanel title="還沒有信件往來" description="這個人名下的報名還沒有任何信件往來。" />}</article>
    <article className="ops-panel"><div className="ops-panel-header"><h2>轉移負責人</h2></div><div className="ops-form-grid"><Select label="接手者" value={transfer.to} onChange={(e) => setTransfer({ ...transfer, to: e.target.value })}><option value="">請選擇</option>{team.map((m) => <option key={m.id} value={m.userId}>{m.displayName || m.email}</option>)}</Select><TextInput label="轉移原因" value={transfer.reason} onChange={(e) => setTransfer({ ...transfer, reason: e.target.value })} /></div><WarmButton onClick={() => void doTransfer()}>確認轉移</WarmButton></article><article className="ops-panel"><div className="ops-panel-header"><h2>內部註記</h2></div><Textarea label="新增註記" value={note} onChange={(e) => setNote(e.target.value)} /><div className="ops-button-row"><WarmButton onClick={() => void addNote()}>儲存註記</WarmButton></div>{notes.map((n) => <div className="ops-note" key={n.id}><p>{n.content}</p><small>第 {n.revision} 版 · {new Date(n.createdAt).toLocaleString('zh-TW')}</small></div>)}</article><article className="ops-panel"><div className="ops-panel-header"><h2>服務與聯絡紀錄</h2></div><div className="ops-form-grid"><Select label="紀錄類型" value={record.kind} onChange={(e) => setRecord({ ...record, kind: e.target.value as 'service' | 'contact' | 'note' })}><option value="service">服務</option><option value="contact">聯絡</option><option value="note">紀錄</option></Select><TextInput type="datetime-local" label="發生時間" value={record.occurredAt} onChange={(e) => setRecord({ ...record, occurredAt: e.target.value })} /><TextInput label="標題" value={record.title} onChange={(e) => setRecord({ ...record, title: e.target.value })} /><div className="ops-full"><Textarea label="完整內容" rows={5} value={record.content} onChange={(e) => setRecord({ ...record, content: e.target.value })} /></div></div><WarmButton onClick={() => void addRecord()}>新增紀錄</WarmButton><div className="ops-list">{selected.records.map((r) => <div className="ops-note" key={r.id}><div className="ops-note-actions"><strong>{r.title}</strong>{confirmingRecordId === r.id
      ? <span className="ops-chip-row"><button type="button" onClick={() => { setConfirmingRecordId(undefined); void archiveServiceRecord(r.id).then(reload).catch((e: unknown) => setError(e instanceof Error ? e.message : '封存紀錄失敗')); }}>確定封存</button><button type="button" onClick={() => setConfirmingRecordId(undefined)}>取消</button></span>
      : <button type="button" onClick={() => setConfirmingRecordId(r.id)}>封存</button>}</div><p>{r.content}</p><small>{r.kind} · {new Date(r.occurredAt).toLocaleString('zh-TW')} · 第 {r.revision ?? 1} 版</small></div>)}</div></article></> : null}</main>
  </div>}</section>;
}

/** 與 `InboxPage.tsx` 同一種寫法：往來訊息只需要月日時分，附件只需要人看得懂的大小。 */
function mailDate(value: string) { return new Date(value).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
function mailBytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1048576) return `${Math.round(value / 1024)} KB`; return `${(value / 1048576).toFixed(1)} MB`; }

