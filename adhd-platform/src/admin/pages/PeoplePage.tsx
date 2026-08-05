import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ListPlus, Mail, NotebookPen, Pencil } from 'lucide-react';
import { TextInput, Textarea, Select } from '@/components/ui/FormField/FormField';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { Modal } from '@/components/ui/Modal/Modal';
import { isSupabaseReady } from '@/lib/supabase';
import { importGmailHistory, listContacts, listNotes, saveNote, saveTask, updateContact } from '../operations/api';
import type { ContactRecord, InternalNote, NoteType, WorkPriority } from '../operations/types';
import { EmptyPanel, InlineSpinner, OpsNotice, PageHeader, StatusPill } from '../operations/components';

const STATUS_LABELS: Record<ContactRecord['status'], string> = { active: '持續聯繫', inactive: '暫停聯繫', do_not_contact: '請勿聯繫', archived: '已封存' };
const NOTE_LABELS: Record<NoteType, string> = { general: '一般註記', contact: '聯繫摘要', eligibility: '資格／需求', handoff: '交接事項', risk: '重要提醒' };

export default function PeoplePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [editOpen, setEditOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!isSupabaseReady) { setLoading(false); return; }
    try {
      const rows = await listContacts();
      setContacts(rows);
      setSelectedId((current) => current && rows.some((item) => item.id === current) ? current : rows[0]?.id);
      setError(undefined);
    } catch (err) { setError(err instanceof Error ? err.message : '讀取人員主檔失敗'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const requested = searchParams.get('contact');
    if (requested && contacts.some((item) => item.id === requested)) setSelectedId(requested);
  }, [contacts, searchParams]);
  const selected = contacts.find((item) => item.id === selectedId);
  useEffect(() => {
    if (!selectedId || !isSupabaseReady) { setNotes([]); return; }
    void listNotes({ contactId: selectedId }).then(setNotes).catch((err) => setError(err instanceof Error ? err.message : '讀取註記失敗'));
  }, [selectedId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return contacts.filter((contact) => {
      const matchesStatus = statusFilter === 'all' || contact.status === statusFilter;
      const haystack = [contact.displayName, contact.primaryEmail, contact.phone, contact.tags.join(' '), ...contact.registrations.map((reg) => reg.projectName ?? '')].join(' ').toLowerCase();
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [contacts, query, statusFilter]);

  async function handleContactSave(values: { displayName: string; primaryEmail: string; phone: string; status: ContactRecord['status']; tags: string; noBulkEmail: boolean }) {
    if (!selected) return;
    try {
      await updateContact(selected.id, { displayName: values.displayName, primaryEmail: values.primaryEmail, phone: values.phone, status: values.status, noBulkEmail: values.noBulkEmail, tags: values.tags.split(/[、,，]/).map((item) => item.trim()).filter(Boolean) });
      setEditOpen(false); setNotice('人員主檔已更新，跨活動關聯不受影響。'); await reload();
    } catch (err) { setError(err instanceof Error ? err.message : '更新失敗'); }
  }

  /**
   * 匯入這個人的完整歷史往來。**不受自動收信起始日限制**——起始日管的是「系統自己去找什麼」，
   * 不是「你能拿什麼」。要跟某位家長談之前按一下，就把你跟他的往來拉進來；不需要的人永遠不拉。
   */
  async function handleImportHistory() {
    if (!selected?.primaryEmail) { setError('這個人沒有信箱，無法匯入往來。'); return; }
    if (!window.confirm(`匯入「${selected.displayName}」（${selected.primaryEmail}）的完整歷史往來？

會把你與這個信箱之間的所有信件排進同步佇列，不受「自動收信起始日」限制。
接著到整合設定按一次同步，內容才會真的被抓進來。`)) return;
    try {
      const result = await importGmailHistory(selected.primaryEmail);
      setNotice(`找到 ${result.found} 封往來，其中 ${result.alreadyStored} 封已經收過；新排入佇列 ${result.queued} 封。請到整合設定按同步把內容抓進來。`);
    } catch (err) { setError(err instanceof Error ? err.message : '匯入歷史往來失敗'); }
  }

  async function handleNoteSave(type: NoteType, content: string) {
    if (!selected || !content.trim()) return;
    try {
      await saveNote({ contactId: selected.id, noteType: type, content });
      setNotes(await listNotes({ contactId: selected.id })); setNoteOpen(false); setNotice('內部註記已保存並納入版本追蹤。');
    } catch (err) { setError(err instanceof Error ? err.message : '註記儲存失敗'); }
  }

  async function handleTaskSave(input: { title: string; description: string; dueAt: string; priority: WorkPriority }) {
    const registration = selected?.registrations[0];
    if (!selected || !registration || !input.title.trim()) return;
    try {
      await saveTask({ projectId: registration.projectId, contactId: selected.id, registrationId: registration.id, title: input.title, description: input.description, dueAt: input.dueAt || undefined, priority: input.priority });
      setTaskOpen(false); setNotice('追蹤任務已加入工作佇列。');
    } catch (err) { setError(err instanceof Error ? err.message : '任務儲存失敗'); }
  }

  return (
    <div>
      <PageHeader eyebrow="People CRM" title="人員主檔" description="同一人的歷次報名、活動、信件、註記與後續任務集中管理，不再用單筆報名切斷服務脈絡。" />
      {!isSupabaseReady ? <OpsNotice tone="warning">目前未連接 Supabase；正式部署會使用受 RLS 保護的人員主檔。</OpsNotice> : null}
      {notice ? <OpsNotice tone="success" role="status">{notice}</OpsNotice> : null}
      {error ? <OpsNotice tone="danger" role="alert">{error}</OpsNotice> : null}
      <div className="ops-toolbar">
        <div className="ops-search"><TextInput label="搜尋人員" name="people-search" value={query} placeholder="姓名、Email、電話、標籤或活動" onChange={(event) => setQuery(event.target.value)} /></div>
        <Select label="聯繫狀態" name="people-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={[{ label: '全部狀態', value: 'all' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
      </div>
      {loading ? <InlineSpinner label="整理人員與歷次報名…" /> : (
        <div className="ops-split">
          <section className="ops-panel ops-panel--flush"><div className="ops-list" style={{ padding: '.8rem' }}>
            {filtered.map((contact) => <button key={contact.id} type="button" onClick={() => setSelectedId(contact.id)} className={`ops-list-button ${contact.id === selected?.id ? 'ops-list-button--active' : ''}`}>
              <div className="ops-list-row"><span><strong>{contact.displayName}</strong><small>{contact.primaryEmail || '未提供 Email'}{contact.phone ? ` · ${contact.phone}` : ''}</small></span><StatusPill tone={contact.status === 'active' ? 'green' : contact.status === 'do_not_contact' ? 'red' : 'gray'}>{STATUS_LABELS[contact.status]}</StatusPill></div>
              <div className="ops-list-meta"><StatusPill tone="blue">{contact.registrations.length} 次報名</StatusPill>{contact.registrations.slice(0, 2).map((reg) => <StatusPill key={reg.id}>{reg.projectName || '未命名服務'}</StatusPill>)}</div>
            </button>)}
            {!filtered.length ? <EmptyPanel title="沒有符合的人員" description="調整搜尋字詞或狀態篩選。" /> : null}
          </div></section>
          <section className="ops-panel">
            {selected ? <>
              <div className="ops-detail-header"><div><h2>{selected.displayName}</h2><p>{selected.primaryEmail || '未提供 Email'}{selected.phone ? `　·　${selected.phone}` : ''}</p></div><StatusPill tone={selected.status === 'active' ? 'green' : 'gray'}>{STATUS_LABELS[selected.status]}</StatusPill></div>
              <div className="ops-button-row"><WarmButton size="sm" icon={Mail} onClick={() => { const reg = selected.registrations[0]; if (reg) navigate(`/admin/inbox?registration=${reg.id}`); }} disabled={!selected.registrations.length}>撰寫信件</WarmButton><WarmButton size="sm" variant="secondary" icon={NotebookPen} onClick={() => setNoteOpen(true)}>新增註記</WarmButton><WarmButton size="sm" variant="secondary" icon={ListPlus} onClick={() => setTaskOpen(true)} disabled={!selected.registrations.length}>建立任務</WarmButton><WarmButton size="sm" variant="secondary" icon={Pencil} onClick={() => setEditOpen(true)}>編輯主檔</WarmButton><WarmButton size="sm" variant="secondary" icon={Mail} onClick={() => void handleImportHistory()} disabled={!selected.primaryEmail}>匯入這個人的歷史往來</WarmButton></div>
              <section className="ops-section"><h3>跨活動服務歷程</h3>{selected.registrations.length ? <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>服務／活動</th><th>報名時間</th><th>狀態</th><th>下一步</th></tr></thead><tbody>{selected.registrations.map((reg) => <tr key={reg.id}><td><Link to={`/admin/registrations?registration=${reg.id}`}>{reg.projectName || reg.projectId}</Link></td><td>{formatDate(reg.createdAt)}</td><td><StatusPill tone={reg.hasUnreadReply ? 'coral' : 'blue'}>{reg.status}</StatusPill></td><td>{reg.nextActionAt ? formatDate(reg.nextActionAt) : '尚未設定'}</td></tr>)}</tbody></table></div> : <EmptyPanel title="尚無報名紀錄" />}</section>
              <section className="ops-section"><div className="ops-panel-header"><div><h3>內部註記</h3><p>與對外信件分開，所有修改保留版本。</p></div><WarmButton size="sm" variant="secondary" onClick={() => setNoteOpen(true)}>新增</WarmButton></div>{notes.length ? notes.map((note) => <article className="ops-note" key={note.id}><header><StatusPill tone={note.noteType === 'risk' ? 'red' : 'yellow'}>{NOTE_LABELS[note.noteType]}</StatusPill><small>第 {note.revision} 版 · {formatDate(note.updatedAt || note.createdAt)}</small></header><p>{note.content}</p></article>) : <EmptyPanel title="尚無內部註記" description="聯繫摘要、資格判斷與交接事項都可留在這裡。" />}</section>
            </> : <EmptyPanel title="請選擇一位人員" />}
          </section>
        </div>
      )}
      {selected ? <ContactEditModal open={editOpen} contact={selected} onClose={() => setEditOpen(false)} onSave={handleContactSave} /> : null}
      <NoteModal open={noteOpen} onClose={() => setNoteOpen(false)} onSave={handleNoteSave} />
      <TaskModal open={taskOpen} onClose={() => setTaskOpen(false)} onSave={handleTaskSave} />
    </div>
  );
}

function ContactEditModal({ open, contact, onClose, onSave }: { open: boolean; contact: ContactRecord; onClose: () => void; onSave: (values: { displayName: string; primaryEmail: string; phone: string; status: ContactRecord['status']; tags: string; noBulkEmail: boolean }) => void }) {
  const [displayName, setDisplayName] = useState(contact.displayName); const [primaryEmail, setPrimaryEmail] = useState(contact.primaryEmail ?? ''); const [phone, setPhone] = useState(contact.phone ?? ''); const [status, setStatus] = useState(contact.status); const [tags, setTags] = useState(contact.tags.join('、')); const [noBulkEmail, setNoBulkEmail] = useState(Boolean(contact.noBulkEmail));
  useEffect(() => { setDisplayName(contact.displayName); setPrimaryEmail(contact.primaryEmail ?? ''); setPhone(contact.phone ?? ''); setStatus(contact.status); setTags(contact.tags.join('、')); setNoBulkEmail(Boolean(contact.noBulkEmail)); }, [contact]);
  return <Modal open={open} onClose={onClose} title="編輯人員主檔" footer={<><WarmButton variant="secondary" onClick={onClose}>取消</WarmButton><WarmButton onClick={() => onSave({ displayName, primaryEmail, phone, status, tags, noBulkEmail })} disabled={!displayName.trim()}>儲存主檔</WarmButton></>}><div className="ops-form-grid"><TextInput label="顯示姓名" name="contact-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /><TextInput label="主要 Email" type="email" name="contact-email" value={primaryEmail} onChange={(e) => setPrimaryEmail(e.target.value)} /><TextInput label="電話" name="contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /><Select label="聯繫狀態" name="contact-status-edit" value={status} onChange={(e) => setStatus(e.target.value as ContactRecord['status'])} options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} /><div className="ops-full"><TextInput label="標籤" name="contact-tags" value={tags} helpText="以逗號或頓號分隔，例如：家長、需回電" onChange={(e) => setTags(e.target.value)} /></div><div className="ops-full"><label className="ops-inline-check"><input type="checkbox" checked={noBulkEmail} onChange={(e) => setNoBulkEmail(e.target.checked)} />不接收群發（一對一往來不受影響——退出群發不等於斷絕聯絡）</label></div></div></Modal>;
}

function NoteModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (type: NoteType, content: string) => void }) {
  const [type, setType] = useState<NoteType>('general'); const [content, setContent] = useState('');
  return <Modal open={open} onClose={onClose} title="新增內部註記" footer={<><WarmButton variant="secondary" onClick={onClose}>取消</WarmButton><WarmButton onClick={() => { void onSave(type, content); setContent(''); }} disabled={!content.trim()}>儲存註記</WarmButton></>}><Select label="註記類型" name="note-type" value={type} onChange={(e) => setType(e.target.value as NoteType)} options={Object.entries(NOTE_LABELS).map(([value, label]) => ({ value, label }))} /><Textarea label="註記內容" name="note-content" rows={7} value={content} onChange={(e) => setContent(e.target.value)} helpText="這是內部紀錄，不會出現在寄給服務對象的信件中。" /></Modal>;
}

function TaskModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (input: { title: string; description: string; dueAt: string; priority: WorkPriority }) => void }) {
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [dueAt, setDueAt] = useState(''); const [priority, setPriority] = useState<WorkPriority>('normal');
  return <Modal open={open} onClose={onClose} title="建立追蹤任務" footer={<><WarmButton variant="secondary" onClick={onClose}>取消</WarmButton><WarmButton onClick={() => { void onSave({ title, description, dueAt, priority }); setTitle(''); setDescription(''); }} disabled={!title.trim()}>加入任務</WarmButton></>}><div className="ops-form-grid"><div className="ops-full"><TextInput label="任務名稱" name="task-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div><TextInput label="期限" type="datetime-local" name="task-due" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /><Select label="優先度" name="task-priority" value={priority} onChange={(e) => setPriority(e.target.value as WorkPriority)} options={[{ value: 'low', label: '低' }, { value: 'normal', label: '一般' }, { value: 'high', label: '高' }, { value: 'urgent', label: '緊急' }]} /><div className="ops-full"><Textarea label="補充說明" name="task-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div></div></Modal>;
}

function formatDate(value: string) { return new Date(value).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }




