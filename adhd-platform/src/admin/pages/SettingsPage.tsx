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
  createContact, getAppSettings, listContactGroups, listContacts, listGmailLabels, setContactGroupMember, updateAppSettings, updateContact,
} from '../operations/api';
import type { AppSettings, ContactGroupRecord, ContactRecord, GmailLabel } from '../operations/types';
import { ContactTable, GroupEditor } from '../operations/SettingsTables';
import { EmptyPanel, InlineSpinner, OpsNotice, PageHeader, SavingIndicator } from '../operations/components';

export default function SettingsPage() {
  const [contacts, setContacts] = useState<ContactRecord[]>([]); const [groups, setGroups] = useState<ContactGroupRecord[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]); const [settings, setSettings] = useState<AppSettings>({ followUpDays: 3 });
  const [loading, setLoading] = useState(true); const [notice, setNotice] = useState<string>(); const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>(); const [search, setSearch] = useState('');
  const [newContact, setNewContact] = useState({ displayName: '', primaryEmail: '', phone: '' });
  const [daysDraft, setDaysDraft] = useState('3');
  const [labels, setLabels] = useState<GmailLabel[]>([]); const [labelError, setLabelError] = useState<string>();

  const reload = async () => {
    const [nextContacts, nextGroups, nextTemplates, nextSettings] = await Promise.all([listContacts(), listContactGroups(), adminListEmailTemplates(), getAppSettings()]);
    setContacts(nextContacts); setGroups(nextGroups); setTemplates(nextTemplates); setSettings(nextSettings); setDaysDraft(String(nextSettings.followUpDays));
  };
  useEffect(() => { reload().catch((e: unknown) => setError(e instanceof Error ? e.message : '讀取設定失敗')).finally(() => setLoading(false)); }, []);
  // 標籤清單讀不到不該讓整頁失敗——它只是下拉的選項來源，其餘設定照樣要能改。
  useEffect(() => { listGmailLabels().then(setLabels).catch((e: unknown) => setLabelError(e instanceof Error ? e.message : '未知錯誤')); }, []);

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
  const saveSyncLabel = async (labelId: string) => {
    const name = labels.find((label) => label.id === labelId)?.name;
    await run('sync-label', () => updateAppSettings({ syncLabelId: labelId }),
      labelId ? `同步標籤已設為「${name ?? labelId}」，下次同步會把帶這個標籤的信收進來。` : '同步標籤已取消；已收的信不受影響。');
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
      {/* 第三條收信規則。存的是 label id，畫面上顯示名稱——標籤改名時 id 不變，
          比對名稱會在你改名的那一刻安靜失效，而且畫面上完全看不出來。 */}
      <div className="ops-form-grid">
        <Select label="同步標籤（Gmail）" value={settings.syncLabelId ?? ''} disabled={busyId === 'sync-label'} onChange={(e) => void saveSyncLabel(e.target.value)}>
          <option value="">不啟用（只收名冊內信箱與已知信件串）</option>
          {labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}
          {/* 已存的 id 不在清單裡（標籤被刪掉了）時，補一個選項，才不會被下拉悄悄改成「不啟用」。 */}
          {settings.syncLabelId && !labels.some((label) => label.id === settings.syncLabelId)
            ? <option value={settings.syncLabelId}>（找不到這個標籤：{settings.syncLabelId}）</option> : null}
        </Select>
      </div>
      <OpsNotice tone="info">
        收信範圍是三條規則的<b>聯集</b>：①對方信箱在報名或常用聯絡人名冊裡 ②信件串已經在系統裡（對方換信箱回同一封信也接得住）
        ③這封信帶著上面選的標籤。第三條是給「用系統不認得的信箱寄來」的家長信或邀約信留的人工救援管道——
        在 Gmail 貼上標籤，下次同步就會收進來，<b>即使那封信之前已經被略過</b>。
        取消標籤<b>不會</b>回頭刪除已收的信；誤收的清理請走人工，同步端沒有刪除權。
      </OpsNotice>
      {labelError ? <OpsNotice tone="warning">讀不到 Gmail 標籤清單（{labelError}）。標籤設定這一區暫時只能維持現狀。</OpsNotice> : null}
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
