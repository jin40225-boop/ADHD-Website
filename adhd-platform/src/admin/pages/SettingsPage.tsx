/**
 * 設定・聯絡人（03_v4）。常用聯絡人與類群可直接編輯；逾期門檻現在只存值，
 * Phase 4 接上狀態機才會生效——介面明說，不做假生效。Claude API 區同理，Phase 6 前誠實佔位。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EmailTemplate } from '@contracts/types';
import { TextInput, Select } from '@/components/ui/FormField/FormField';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { adminListEmailTemplates } from '@/lib/api';
import {
  createContact, getAppSettings, listContactGroups, listContacts, setContactGroupMember, updateAppSettings, updateContact,
} from '../operations/api';
import type { AppSettings, ContactGroupRecord, ContactRecord } from '../operations/types';
import { ContactTable, GroupEditor } from '../operations/SettingsTables';
import { EmptyPanel, InlineSpinner, OpsNotice, PageHeader, SavingIndicator } from '../operations/components';

export default function SettingsPage() {
  const [contacts, setContacts] = useState<ContactRecord[]>([]); const [groups, setGroups] = useState<ContactGroupRecord[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]); const [settings, setSettings] = useState<AppSettings>({ followUpDays: 3 });
  const [loading, setLoading] = useState(true); const [notice, setNotice] = useState<string>(); const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>(); const [search, setSearch] = useState('');
  const [newContact, setNewContact] = useState({ displayName: '', primaryEmail: '', phone: '' });
  const [daysDraft, setDaysDraft] = useState('3');

  const reload = async () => {
    const [nextContacts, nextGroups, nextTemplates, nextSettings] = await Promise.all([listContacts(), listContactGroups(), adminListEmailTemplates(), getAppSettings()]);
    setContacts(nextContacts); setGroups(nextGroups); setTemplates(nextTemplates); setSettings(nextSettings); setDaysDraft(String(nextSettings.followUpDays));
  };
  useEffect(() => { reload().catch((e: unknown) => setError(e instanceof Error ? e.message : '讀取設定失敗')).finally(() => setLoading(false)); }, []);

  const favorites = useMemo(() => contacts.filter((contact) => contact.isFavorite), [contacts]);
  const searched = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return [];
    return contacts.filter((contact) => `${contact.displayName} ${contact.primaryEmail ?? ''}`.toLowerCase().includes(keyword)).slice(0, 20);
  }, [contacts, search]);

  const run = async (id: string, action: () => Promise<void>, message: string) => {
    setBusyId(id);
    try { await action(); await reload(); setNotice(message); setError(undefined); }
    catch (e) { setError(e instanceof Error ? e.message : '寫入失敗'); }
    finally { setBusyId(undefined); }
  };
  const contactHandlers = {
    busyId,
    onPatch: (contact: ContactRecord, patch: Parameters<typeof updateContact>[1]) =>
      void run(contact.id, () => updateContact(contact.id, patch), '聯絡人已更新，歷程已記錄。'),
  };
  const groupHandlers = {
    busyKey: busyId,
    onToggleMember: (group: ContactGroupRecord, contactId: string, member: boolean) =>
      void run(group.id, () => setContactGroupMember(group.id, contactId, member), member ? '已加入類群。' : '已移出類群。'),
  };
  const addContact = async () => {
    if (!newContact.displayName.trim()) { setError('請填稱呼。'); return; }
    await run('new-contact', async () => {
      await createContact({ ...newContact, isFavorite: true });
      setNewContact({ displayName: '', primaryEmail: '', phone: '' });
    }, '已新增常用聯絡人。');
  };
  const saveDays = async () => {
    const value = Number(daysDraft);
    if (!Number.isInteger(value) || value < 0 || value > 60) { setError('逾期門檻請填 0–60 的整數天數。'); return; }
    await run('settings', () => updateAppSettings({ followUpDays: value }), `逾期門檻已存為 ${value} 天（Phase 4 狀態機接線後生效）。`);
  };

  const drafts = templates.filter((template) => template.reviewStatus === 'draft');

  if (loading) return <InlineSpinner />;
  return <section className="ops-section">
    <SavingIndicator active={Boolean(busyId)} />
    <PageHeader eyebrow="設定" title="設定・聯絡人" description="常用聯絡人、類群、信件狀態門檻與範本庫。" />
    {notice ? <OpsNotice tone="success">{notice}</OpsNotice> : null}{error ? <OpsNotice tone="danger">{error}</OpsNotice> : null}

    <article className="ops-panel">
      <div className="ops-panel-header"><div><h2>👥 常用聯絡人</h2><p>置頂於寄件人／副本選單。欄位可直接改，改動會記錄歷程。</p></div></div>
      {favorites.length ? <ContactTable contacts={favorites} handlers={contactHandlers} /> : <EmptyPanel title="尚未標記任何常用聯絡人" description="可在下方搜尋既有聯絡人並勾選「常用」，或直接新增。" />}
      <div className="ops-panel-header" style={{ marginTop: '1rem' }}><div><h2>＋ 新增聯絡人</h2><p>新增的聯絡人預設就是常用；不需要置頂時取消勾選即可。</p></div></div>
      <div className="ops-form-grid">
        <TextInput label="稱呼" value={newContact.displayName} onChange={(e) => setNewContact({ ...newContact, displayName: e.target.value })} />
        <TextInput label="信箱" type="email" value={newContact.primaryEmail} onChange={(e) => setNewContact({ ...newContact, primaryEmail: e.target.value })} />
        <TextInput label="電話（選填）" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
      </div>
      <div className="ops-button-row"><WarmButton onClick={() => void addContact()}>新增聯絡人</WarmButton></div>

      <div className="ops-panel-header" style={{ marginTop: '1rem' }}><div><h2>搜尋既有聯絡人</h2><p>名冊共 {contacts.length} 人；搜尋後可直接改欄位或勾選為常用。</p></div></div>
      <div className="ops-toolbar"><TextInput label="搜尋" placeholder="稱呼或信箱" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {search.trim() ? (searched.length ? <ContactTable contacts={searched} handlers={contactHandlers} /> : <EmptyPanel title="沒有符合的聯絡人" />) : null}
    </article>

    <article className="ops-panel">
      <div className="ops-panel-header"><div><h2>🗂 聯絡人類群</h2><p>群發時可整組選取。標「自動」的成員由報名成立時自動歸群，手動加入與移出都會記錄歷程。</p></div></div>
      {groups.length ? <GroupEditor groups={groups} contacts={contacts} handlers={groupHandlers} /> : <EmptyPanel title="尚未建立類群" />}
    </article>

    <article className="ops-panel">
      <div className="ops-panel-header"><div><h2>📥 收信連動與信件狀態</h2></div></div>
      <div className="ops-pipe">
        <span>名冊內信箱寄信</span><b>→</b><span>jin40225@gmail.com</span><b>→</b><span>定期偵測（增量同步）</span><b>→</b><span>比對名冊＋常用聯絡人</span><b>→</b><span>自動掛入信件串</span>
      </div>
      <OpsNotice tone="info">不在名冊的來信會留在「未歸戶收件匣」，由你手動歸戶或忽略。實際的同步操作在 <Link to="/admin/integrations">整合設定</Link>。</OpsNotice>
      <div className="ops-form-grid">
        <TextInput type="number" label="逾期門檻（天）" value={daysDraft} onChange={(e) => setDaysDraft(e.target.value)} />
      </div>
      <OpsNotice tone="warning">
        這個門檻<b>現在只是存起來</b>：信件狀態機要到 <b>Phase 4</b> 才會依它判定「逾期未回覆」。在那之前改這個數字，後台顯示的信件狀態不會有任何變化——不是壞了，是還沒接線。
      </OpsNotice>
      <div className="ops-button-row"><WarmButton onClick={() => void saveDays()}>儲存門檻</WarmButton></div>
      {settings.updatedAt ? <p className="ops-cell-muted">上次更新：{new Date(settings.updatedAt).toLocaleString('zh-TW')}</p> : null}
    </article>

    <article className="ops-panel">
      <div className="ops-panel-header"><div><h2>🤖 Claude API 設定</h2></div></div>
      <OpsNotice tone="warning">
        <b>Phase 6 才會啟用</b>，因此這一區的控制項全部停用、也不接受輸入。金鑰屆時存於 Supabase secrets，前端永不落地；
        去識別化（姓名／電話／信箱代號化）依裁決固定啟用、不可關閉。這裡先不做輸入框，是為了避免看起來能填、填了卻沒有任何地方接收。
      </OpsNotice>
      <div className="ops-form-grid">
        <Select label="模型" value="" disabled onChange={() => {}}><option value="">（Phase 6 設定）</option></Select>
        <Select label="去識別化" value="on" disabled onChange={() => {}}><option value="on">固定啟用（裁決 15，不可關閉）</option></Select>
      </div>
    </article>

    <article className="ops-panel">
      <div className="ops-panel-header"><div><h2>📚 信件範本庫</h2><p>共 {templates.length} 封，其中 {drafts.length} 封為 AI 起草、待你審閱。全文編輯在範本管理頁。</p></div></div>
      <div className="ops-table-wrap"><table className="ops-table">
        <thead><tr><th>範本</th><th>主旨</th><th>審閱狀態</th><th></th></tr></thead>
        <tbody>{templates.map((template) => <tr key={template.id}>
          <td><strong>{template.name}</strong></td>
          <td><span className="ops-cell-muted">{template.subject}</span></td>
          <td>{template.reviewStatus === 'draft'
            ? <span className="ops-status ops-status--yellow">待審閱</span>
            : <span className="ops-status ops-status--green">已定稿</span>}</td>
          <td><Link className="ops-link-button" to="/admin/templates">編輯全文</Link></td>
        </tr>)}</tbody>
      </table></div>
      <OpsNotice tone="info">6 封草稿依計畫在 <b>Phase 4</b> 以「變數帶入後的預覽」逐封審定；審定後才會把狀態改為已定稿。</OpsNotice>
    </article>
  </section>;
}
