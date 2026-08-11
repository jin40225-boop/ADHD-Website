/**
 * 文件產生中心（03_v4）。Phase 6 起產出功能已啟用。
 *
 * 產出走兩段：先要一份**預覽**（不呼叫 API，只回傳「等一下會送出的那份字」），使用者看過再按生成。
 * 預覽與實際送出的內容由 Edge Function 的同一段程式算出，不是另外寫一份「大概像這樣」的說明——
 * 否則使用者審閱的東西與實際送出的東西可以無聲地分岔，那就等於沒有審閱。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EmailTemplate, Project, SessionSlot } from '@contracts/types';
import { TextInput, Textarea, Select } from '@/components/ui/FormField/FormField';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { adminListEmailTemplates, adminListProjects, adminListSessions, invokeBulkEmail, invokeGenerateDocument } from '@/lib/api';
import { listContactGroups, listContacts, listGeneratedDocuments } from '../operations/api';
import type { ContactGroupRecord, ContactRecord, GeneratedDocumentRecord } from '../operations/types';
import { applyTemplate, buildBulkContext, residualVariables, resolveBulkRecipients, sessionAttendeeIds } from '../operations/emailCompose';
import { EmptyPanel, InlineSpinner, OpsNotice, PageHeader } from '../operations/components';
import { sessionDateText, sessionTimeText } from '../operations/SessionTable';

/** 03_v4 列出的集體性文件類型。單一報名者的信件、單一場次的行政文件都不在這裡。 */
const DOC_TYPES = [
  '月度活動宣傳與通知信（群發）',
  '整批行前提醒信（該場全部報名者）',
  '活動計畫書（外部版）',
  'FB／網路宣傳文',
  '年度成果彙整',
  '自訂需求（用一句話描述）',
];

export default function DocumentsPage() {
  const [sessions, setSessions] = useState<SessionSlot[]>([]); const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<ContactGroupRecord[]>([]); const [documents, setDocuments] = useState<GeneratedDocumentRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]); const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string>(); const [notice, setNotice] = useState<string>();
  const [docType, setDocType] = useState(DOC_TYPES[0]); const [scope, setScope] = useState('all-h2'); const [audience, setAudience] = useState('none'); const [note, setNote] = useState('');
  const [bulk, setBulk] = useState({ groupIds: [] as string[], includeIds: [] as string[], excludeIds: [] as string[], sessionId: '', templateId: '', subject: '', body: '' });
  const [sending, setSending] = useState(false); const [confirming, setConfirming] = useState(false);
  /** 生成的兩段式：先拿 willSend（不呼叫 API），使用者看過才真的產。 */
  const [genPreview, setGenPreview] = useState<{ willSend: string; redactedNames: number; model: string }>();
  const [generating, setGenerating] = useState(false);

  const DOC_TYPE_KEYS: Record<string, string> = {
    '月度活動宣傳與通知信（群發）': 'monthly_report',
    '整批行前提醒信（該場全部報名者）': 'followup_notes',
    '活動計畫書（外部版）': 'session_summary',
    'FB／網路宣傳文': 'monthly_report',
    '年度成果彙整': 'monthly_report',
    '自訂需求（用一句話描述）': 'session_summary',
  };
  const previewGeneration = async () => {
    setGenerating(true); setError(undefined); setNotice(undefined);
    try {
      const result = await invokeGenerateDocument({ docType: DOC_TYPE_KEYS[docType], sessionId: scope === 'all-h2' ? undefined : scope, instruction: note, preview: true });
      setGenPreview({ willSend: result.willSend ?? '', redactedNames: result.redactedNames ?? 0, model: result.model ?? '' });
    } catch (e) { setError(e instanceof Error ? e.message : '預覽失敗'); }
    finally { setGenerating(false); }
  };
  const runGeneration = async () => {
    setGenerating(true); setError(undefined);
    try {
      const result = await invokeGenerateDocument({ docType: DOC_TYPE_KEYS[docType], sessionId: scope === 'all-h2' ? undefined : scope, instruction: note });
      setGenPreview(undefined);
      await reload();
      setNotice(`草稿已產生（去識別化 ${result.redactedNames ?? 0} 個姓名）。狀態為「draft」，要寄出請自行審閱後從報名工作台或群發區操作——AI 不會自己寄。`);
    } catch (e) { setError(e instanceof Error ? e.message : '生成失敗'); }
    finally { setGenerating(false); }
  };

  const reload = () => Promise.all([adminListSessions(), adminListProjects(), listContactGroups(), listGeneratedDocuments(), listContacts(), adminListEmailTemplates()])
    .then(([nextSessions, nextProjects, nextGroups, nextDocuments, nextContacts, nextTemplates]) => {
      setSessions(nextSessions); setProjects(nextProjects); setGroups(nextGroups); setDocuments(nextDocuments);
      setContacts(nextContacts); setTemplates(nextTemplates);
    });
  useEffect(() => {
    reload()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '讀取文件中心資料失敗'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const projectName = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  /** 選擇器接真實場次，Phase 6 接線時不必再換資料來源。已完成的場次不列入產生範圍。 */
  const scopeOptions = useMemo(() => sessions.filter((session) => session.status !== 'done' && session.status !== 'cancelled'), [sessions]);

  /** 選定場次的可讀名稱，作為群發名單上該來源的標籤。 */
  const sessionVia = useMemo(() => {
    const session = sessions.find((item) => item.id === bulk.sessionId);
    return session ? `場次 ${sessionDateText(session.startsAt)} ${sessionTimeText(session.startsAt)}` : '';
  }, [sessions, bulk.sessionId]);
  const sessionIncludes = useMemo(
    () => (bulk.sessionId ? sessionAttendeeIds(contacts, bulk.sessionId).map((contactId) => ({ contactId, via: sessionVia })) : []),
    [contacts, bulk.sessionId, sessionVia],
  );
  const { recipients, skipped } = useMemo(
    () => resolveBulkRecipients(groups, contacts, { ...bulk, sessionIncludes }),
    [groups, contacts, bulk, sessionIncludes],
  );
  // 主旨與內文都要看：主旨裡漏一個 {{月份}} 同樣是寄給所有人。
  const residual = useMemo(() => residualVariables(bulk.subject, bulk.body), [bulk.subject, bulk.body]);
  const sendBulk = async () => {
    setSending(true);
    try {
      const result = await invokeBulkEmail({ contactIds: recipients.map((item) => item.contactId), subject: bulk.subject, body: bulk.body });
      await reload();
      setConfirming(false);
      setBulk({ groupIds: [], includeIds: [], excludeIds: [], sessionId: '', templateId: '', subject: '', body: '' });
      setError(undefined);
      // 0 封不是成功。名單空掉（例如類群裡一個人也沒有）時，「全部成功」會讓人以為通知過了。
      if (!result.sent) setError(`一封也沒有寄出——最終名單上沒有任何收得到信的人${result.failed.length ? `，${result.failed.length} 封失敗` : ''}。`);
      else setNotice(result.failed.length
        ? `已寄出 ${result.sent} 封，${result.failed.length} 封失敗（失敗原因已記入稽核）。`
        : `已寄出 ${result.sent} 封，全部成功。`);
    } catch (e) { setError(e instanceof Error ? e.message : '群發失敗'); }
    finally { setSending(false); }
  };

  if (loading) return <InlineSpinner />;
  return <section className="ops-section">
    <PageHeader eyebrow="文件" title="📄 文件產生中心" description="只做整合性、集體性的文件。單一報名者的信件在報名工作台的詳情抽屜，單一場次的行政文件在場次詳情。" />
    {notice ? <OpsNotice tone="success">{notice}</OpsNotice> : null}
    {error ? <OpsNotice tone="danger">{error}</OpsNotice> : null}

    <article className="ops-panel">
      <div className="ops-panel-header"><div><h2>產生設定</h2><p>流程：選類型 → 選範圍 → <b>看過將送出的資料</b> → Claude 產草稿 → 你全文審閱 → 寄出或匯出。AI 永不自行寄出。</p></div></div>
      <div className="ops-form-grid">
        <Select label="文件類型" value={docType} onChange={(e) => setDocType(e.target.value)}>
          {DOC_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </Select>
        <Select label="場次／範圍" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="all-h2">整個下半年（跨場次彙整）</option>
          {scopeOptions.map((session) => <option key={session.id} value={session.id}>
            {projectName.get(session.projectId) ?? '—'}｜{sessionDateText(session.startsAt)} {sessionTimeText(session.startsAt)}
          </option>)}
        </Select>
        <Select label="收件對象" value={audience} onChange={(e) => setAudience(e.target.value)}>
          <option value="none">不寄送，只產出文件</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}（{group.members.length} 人）</option>)}
        </Select>
        <TextInput label="補充指示（選填）" placeholder="例：語氣輕鬆、強調可當天直接參加" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="ops-button-row">
        {genPreview
          ? <>
            <WarmButton disabled={generating} onClick={() => void runGeneration()}>{generating ? '生成中…' : '確認送出並產生草稿'}</WarmButton>
            <WarmButton variant="secondary" disabled={generating} onClick={() => setGenPreview(undefined)}>取消</WarmButton>
          </>
          : <WarmButton disabled={generating} onClick={() => void previewGeneration()}>{generating ? '準備中…' : '🤖 檢視將送出的資料'}</WarmButton>}
      </div>
      {genPreview ? <div className="ops-override-box">
        <p className="ops-cell-muted">以下是<b>實際會送給 Claude 的全部內容</b>（已去識別化 {genPreview.redactedNames} 個姓名，模型 {genPreview.model}）。看過再按確認。</p>
        <pre className="ops-willsend">{genPreview.willSend}</pre>
      </div> : null}
      <OpsNotice tone="info">
        姓名／電話／信箱一律代號化後才送 API（裁決 15，去識別化固定啟用），草稿回來後只還原姓名——聯絡方式不還原，AI 沒有理由自己寫出它們。
        金鑰只存在 Supabase secrets（`ANTHROPIC_API_KEY`），不經過瀏覽器也不寫在資料表；<Link to="/admin/settings">設定・聯絡人</Link> 的說明同步更新。
      </OpsNotice>
    </article>

    <article className="ops-panel">
      <div className="ops-panel-header"><div><h2>📨 範本群發（可用）</h2><p>選類群、加選或排除特定人，寄出前一定會先看到最終名單。這一區不經過 AI，是直接套範本寄信。</p></div></div>
      <div className="ops-chip-row">{groups.map((group) => <label className="ops-member-chip" key={group.id}>
        <input type="checkbox" checked={bulk.groupIds.includes(group.id)} onChange={(e) => {
          setConfirming(false);
          setBulk({ ...bulk, groupIds: e.target.checked ? [...bulk.groupIds, group.id] : bulk.groupIds.filter((id) => id !== group.id) });
        }} />
        {group.name}<span className="ops-cell-legacy">{group.members.length}</span>
      </label>)}</div>
      <div className="ops-form-grid">
        <Select label="依場次選收件人（該場全部報名者）" value={bulk.sessionId} onChange={(e) => { setConfirming(false); setBulk({ ...bulk, sessionId: e.target.value }); }}>
          <option value="">不依場次篩選</option>
          {scopeOptions.map((session) => <option key={session.id} value={session.id}>
            {projectName.get(session.projectId) ?? '—'}｜{sessionDateText(session.startsAt)} {sessionTimeText(session.startsAt)}
          </option>)}
        </Select>
        <Select label="另外加選特定人" value="" onChange={(e) => { if (e.target.value) { setConfirming(false); setBulk({ ...bulk, includeIds: [...new Set([...bulk.includeIds, e.target.value])] }); } }}>
          <option value="">選擇…</option>
          {contacts.filter((contact) => contact.primaryEmail).map((contact) => <option key={contact.id} value={contact.id}>{contact.displayName}（{contact.primaryEmail}）</option>)}
        </Select>
        <Select label="範本" value={bulk.templateId} onChange={(e) => {
          const template = templates.find((item) => item.id === e.target.value);
          setConfirming(false);
          // 非個人變數在載入範本時就帶入——月度宣傳信整封都靠 {{月份}}{{場次清單}}{{報名連結}}，
          // 不帶就會把大括號原樣寄給所有人。個人變數不帶（群發沒有單一對象），留著讓下面的守門擋。
          const context = buildBulkContext(sessions, `${location.origin}${import.meta.env.BASE_URL}`);
          setBulk({
            ...bulk, templateId: e.target.value,
            subject: template ? applyTemplate(template.subject, context).text : bulk.subject,
            body: template ? applyTemplate(template.body, context).text : bulk.body,
          });
        }}>
          <option value="">不套範本，自己寫</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.reviewStatus === 'draft' ? '（待審閱）' : ''}</option>)}
        </Select>
        <div className="ops-full"><TextInput label="主旨" value={bulk.subject} onChange={(e) => { setConfirming(false); setBulk({ ...bulk, subject: e.target.value }); }} /></div>
        <div className="ops-full"><Textarea label="內容" rows={8} value={bulk.body} onChange={(e) => { setConfirming(false); setBulk({ ...bulk, body: e.target.value }); }} /></div>
      </div>
      <OpsNotice tone="info">
        群發不附「確認出席／請假改期」按鈕，也不會改動任何人的報名狀態——那兩件事屬於一對一的往來，在報名工作台的詳情裡做。
        群發信件會各自建立以聯絡人為主的信件串。載入範本時只帶入<b>非個人變數</b>（{'{{月份}}{{場次清單}}{{報名連結}}'}）；
        {'{{姓名}}'} 這類在群發沒有單一對象可代入，請自己改寫成人人都讀得通的說法。
      </OpsNotice>
      {residual.length ? <OpsNotice tone="warning">
        內容裡還有沒帶入的變數：<b>{residual.map((name) => `{{${name}}}`).join('、')}</b>。
        群發一次就寄給所有人，沒有逐封補的機會，所以寄出鈕會停用到這些大括號被處理掉為止。
      </OpsNotice> : null}
      <div className="ops-panel-header" style={{ marginTop: '.8rem' }}><div><h2>最終名單（{recipients.length} 人）</h2><p>去重後的實際收件人。點 ✕ 可把某人從這次群發排除。</p></div></div>
      {recipients.length ? <div className="ops-chip-row">{recipients.map((recipient) => <span className="ops-member-chip" key={recipient.contactId}>
        {recipient.displayName}<span className="ops-cell-legacy">{recipient.via}</span>
        <button type="button" title="這次不寄給他" onClick={() => { setConfirming(false); setBulk({ ...bulk, excludeIds: [...bulk.excludeIds, recipient.contactId] }); }}>✕</button>
      </span>)}</div> : <EmptyPanel title="還沒有收件人" description="先勾選類群，或加選特定人。" />}
      {skipped.length ? <OpsNotice tone="warning">
        以下 {skipped.length} 位在名單內但**寄不到**，不會列入寄出數：{skipped.map((item) => `${item.displayName}（${item.reason}）`).join('、')}
      </OpsNotice> : null}
      {bulk.excludeIds.length ? <p className="ops-cell-muted">已排除 {bulk.excludeIds.length} 人。<button type="button" className="ops-link-button" onClick={() => setBulk({ ...bulk, excludeIds: [] })}>復原排除</button></p> : null}
      <div className="ops-button-row">
        {confirming
          ? <>
            <WarmButton disabled={sending} onClick={() => void sendBulk()}>{sending ? '寄送中…' : `確認寄給這 ${recipients.length} 人`}</WarmButton>
            <WarmButton variant="secondary" onClick={() => setConfirming(false)}>取消</WarmButton>
          </>
          : <WarmButton disabled={!recipients.length || !bulk.subject.trim() || !bulk.body.trim() || residual.length > 0} onClick={() => setConfirming(true)}>預覽名單並寄出</WarmButton>}
      </div>
    </article>

    <article className="ops-panel">
      <div className="ops-panel-header"><div><h2>🗂 生成紀錄</h2><p>已產生的文件會列在這裡，含類型、範圍與是否已寄出。</p></div></div>
      {documents.length ? <div className="ops-table-wrap"><table className="ops-table">
        <thead><tr><th>文件</th><th>類型</th><th>範圍</th><th>狀態</th><th>產生時間</th></tr></thead>
        <tbody>{documents.map((document) => <tr key={document.id}>
          <td><strong>{document.title || '（未命名）'}</strong></td>
          <td><span className="ops-cell-muted">{document.docType}</span></td>
          <td><span className="ops-cell-muted">{document.scope}</span></td>
          <td><span className="ops-status ops-status--gray">{document.status}</span></td>
          <td><span className="ops-cell-muted">{new Date(document.createdAt).toLocaleString('zh-TW')}</span></td>
        </tr>)}</tbody>
      </table></div> : <EmptyPanel title="還沒有任何生成紀錄" description="還沒有生成過任何文件，用下面的表單產一份草稿。" />}
    </article>
  </section>;
}
