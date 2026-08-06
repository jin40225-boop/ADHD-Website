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
  const [keywordDraft, setKeywordDraft] = useState(''); const [sinceDraft, setSinceDraft] = useState('');

  const reload = async () => {
    const [nextContacts, nextGroups, nextTemplates, nextSettings] = await Promise.all([listContacts(), listContactGroups(), adminListEmailTemplates(), getAppSettings()]);
    setContacts(nextContacts); setGroups(nextGroups); setTemplates(nextTemplates); setSettings(nextSettings); setDaysDraft(String(nextSettings.followUpDays)); setKeywordDraft((nextSettings.syncSubjectKeywords ?? []).join('、')); setSinceDraft(nextSettings.syncSince ?? '');
  };
  useEffect(() => { reload().catch((e: unknown) => setError(e instanceof Error ? e.message : '讀取設定失敗')).finally(() => setLoading(false)); }, []);
  // 標籤清單讀不到不該讓整頁失敗——它只是下拉的選項來源，其餘設定照樣要能改。
  useEffect(() => { listGmailLabels().then(setLabels).catch((e: unknown) => setLabelError(e instanceof Error ? e.message : '未知錯誤')); }, []);

  // 新清單為空時退回舊的單選欄位——與 gmail-sync 的讀取邏輯一致，
  // 否則畫面會顯示「一個都沒勾」而後端其實還在用舊設定收信。
  const selectedLabelIds = useMemo(
    () => (settings.syncLabelIds?.length ? settings.syncLabelIds : [settings.syncLabelId].filter(Boolean) as string[]),
    [settings.syncLabelIds, settings.syncLabelId],
  );
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
  const saveSince = async () => {
    await run('sync-since', () => updateAppSettings({ syncSince: sinceDraft || null }),
      sinceDraft ? `自動收信起始日已設為 ${sinceDraft}；這之前的信不會自動收進來。` : '起始日已清空——自動搜尋將不再受時間限制，每個人的完整歷史都會被拉進來。');
  };
  const saveKeywords = async () => {
    const words = [...new Set(keywordDraft.split(/[、,，]/).map((word) => word.trim()).filter(Boolean))];
    await run('sync-keywords', () => updateAppSettings({ syncSubjectKeywords: words }),
      words.length ? `主旨關鍵字已存為「${words.join('」「')}」。` : '主旨關鍵字已清空；第四條規則不啟用。');
  };
  const saveSyncLabels = async (ids: string[]) => {
    const names = ids.map((id) => labels.find((label) => label.id === id)?.name ?? id);
    await run('sync-label', () => updateAppSettings({ syncLabelIds: ids }),
      ids.length
        ? `同步標籤已設為「${names.join('」「')}」，下次同步會把帶其中任一個標籤的信收進來。`
        : '同步標籤已全部取消；已收的信不受影響。');
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
      <OpsNotice tone="info">
        這個門檻<b>已生效</b>（Phase 4 已接線）：<b>寄出信件的當下</b>用它算出那封信的回覆期限，存在該信件串上；催覆信裡寫的期限也讀這個值。<b>改這個數字只影響之後寄出的信</b>——既有信件的期限在寄出時就已經定了，不會回頭重算。
      </OpsNotice>
      <div className="ops-button-row"><WarmButton onClick={() => void saveDays()}>儲存門檻</WarmButton></div>
      {/* 第三條收信規則，可複選。存的是 label id、畫面上顯示名稱——標籤改名時 id 不變，
          比對名稱會在你改名的那一刻安靜失效，而且畫面上完全看不出來。
          複選是因為三條規則本來就是聯集：名字很像的標籤（ADHD相關資訊／ADHD重要訊息）
          只能挑一個時，挑錯就是整輪驗收白跑。 */}
      <p className="ops-cell-muted" style={{ marginTop: '.8rem' }}>同步標籤（Gmail，可複選；勾選的<b>任一個</b>符合就收）</p>
      <div className="ops-chip-row">
        {labels.map((label) => <label className="ops-member-chip" key={label.id}>
          <input
            type="checkbox" checked={selectedLabelIds.includes(label.id)} disabled={busyId === 'sync-label'}
            onChange={(e) => void saveSyncLabels(e.target.checked ? [...selectedLabelIds, label.id] : selectedLabelIds.filter((id) => id !== label.id))}
          />
          {label.name}
        </label>)}
        {/* 已存的 id 不在清單裡（標籤被刪掉了）也要顯示，否則它會無聲留在設定裡繼續生效。 */}
        {selectedLabelIds.filter((id) => !labels.some((label) => label.id === id)).map((id) => <label className="ops-member-chip" key={id}>
          <input type="checkbox" checked disabled={busyId === 'sync-label'} onChange={() => void saveSyncLabels(selectedLabelIds.filter((item) => item !== id))} />
          （找不到這個標籤：{id}）
        </label>)}
      </div>
      {!selectedLabelIds.length ? <p className="ops-cell-muted">目前一個都沒勾＝第三條規則不啟用，只收名冊內信箱與已知信件串。</p> : null}
      <OpsNotice tone="info">
        收信範圍是三條規則的<b>聯集</b>：①對方信箱在報名或常用聯絡人名冊裡 ②信件串已經在系統裡（對方換信箱回同一封信也接得住）
        ③這封信帶著上面勾選的<b>任一個</b>標籤。第三條是給「用系統不認得的信箱寄來」的家長信或邀約信留的人工救援管道——
        在 Gmail 貼上標籤，下次同步就會收進來，<b>即使那封信之前已經被略過</b>。
        取消標籤<b>不會</b>回頭刪除已收的信；誤收的清理請走人工，同步端沒有刪除權。
      </OpsNotice>
      <OpsNotice tone="warning">
        勾選前先想一下那個標籤的範圍。像 <b>marketing</b>、<b>notification</b> 這類涵蓋很廣的標籤，
        會把大量與本系統無關的信件<b>連同內文</b>收進資料庫——你的信箱裡就有這種標籤。
        建議只勾為了這件事另外建立的標籤。
      </OpsNotice>
      {/* 第四條規則：主旨關鍵字。與標籤同樣是「搜尋整個信箱」，不受最新 N 封限制。 */}
      <div className="ops-form-grid">
        <div className="ops-full"><TextInput
          label="主旨關鍵字（第四條規則，以逗號或頓號分隔）"
          value={keywordDraft}
          helpText="主旨含其中任一個就收。Gmail 搜尋不分大小寫，所以像 add 這種短字會命中 Add／Added／Address，廣告信會大量中獎——建議用完整、少見的詞。"
          onChange={(e) => setKeywordDraft(e.target.value)}
        /></div>
      </div>
      <div className="ops-button-row"><WarmButton variant="secondary" onClick={() => void saveKeywords()}>儲存關鍵字</WarmButton></div>
      {/* 收信範圍的第二個維度：時間。沒有它的話，規則一開就把每個人從古至今的往來全拉進來。 */}
      <div className="ops-form-grid">
        <TextInput
          type="date" label="自動收信起始日" value={sinceDraft}
          helpText="這個日期之前的信不會自動收進來。"
          onChange={(e) => setSinceDraft(e.target.value)}
        />
      </div>
      <div className="ops-button-row"><WarmButton variant="secondary" onClick={() => void saveSince()}>儲存起始日</WarmButton></div>
      <OpsNotice tone="info">
        起始日只管<b>系統自己去找什麼</b>，不管<b>你能拿什麼</b>。兩個不受它限制的入口：
        ①在 Gmail 貼上上面勾選的標籤——不論那封信多舊都會被收進來；
        ②人員主檔與報名詳情裡的「<b>匯入這個人的歷史往來</b>」——要跟某位家長談之前，按一下就把你跟他的完整往來拉進來。
        平常只長出新的往來，需要誰的歷史時你主動去拿。
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
