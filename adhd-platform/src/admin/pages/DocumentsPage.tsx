/**
 * 文件產生中心（03_v4）。Phase 6 起產出功能已啟用。
 *
 * 產出走兩段：先要一份**預覽**（不呼叫 API，只回傳「等一下會送出的那份字」），使用者看過再按生成。
 * 預覽與實際送出的內容由 Edge Function 的同一段程式算出，不是另外寫一份「大概像這樣」的說明——
 * 否則使用者審閱的東西與實際送出的東西可以無聲地分岔，那就等於沒有審閱。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { EmailTemplate, Project, SessionSlot } from '@contracts/types';
import { TextInput, Textarea, Select } from '@/components/ui/FormField/FormField';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { adminListEmailTemplates, adminListProjects, adminListSessions, invokeBulkEmail, invokeGenerateDocument } from '@/lib/api';
import { listContactGroups, listContacts, listGeneratedDocuments } from '../operations/api';
import type { ContactGroupRecord, ContactRecord, GeneratedDocumentRecord } from '../operations/types';
import { applyTemplate, buildBulkContext, residualVariables, resolveBulkRecipients, sessionAttendeeIds } from '../operations/emailCompose';
import { groupTemplates } from '../operations/templateGroups';
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

/**
 * 六個選項一對一對應六個 docType。先前六個選項只壓成三個 key（三個選項共用同一份提示詞），
 * 選單看起來有六種產出，實際只有三種——那是選單在騙人，不是功能少。
 */
const DOC_TYPE_KEYS: Record<string, string> = {
  '月度活動宣傳與通知信（群發）': 'monthly_notice',
  '整批行前提醒信（該場全部報名者）': 'pre_event_reminder',
  '活動計畫書（外部版）': 'event_plan',
  'FB／網路宣傳文': 'social_post',
  '年度成果彙整': 'annual_report',
  '自訂需求（用一句話描述）': 'custom',
};
/** 這三型本質上跨場次，選單一場次對產出沒有影響——所以就不給選，而不是給了不算數。 */
const AGGREGATE_ONLY_KEYS = ['monthly_notice', 'social_post', 'annual_report'];

/**
 * `doc_type` → 生成紀錄上顯示的名字。
 *
 * 六個新鍵直接反轉 `DOC_TYPE_KEYS`，不另外抄一份：選單上寫什麼，紀錄上就該看到什麼，
 * 兩份手寫對照遲早各說各話。舊四鍵（session_summary／attendance_sheet／followup_notes／
 * monthly_report）已不在選單裡，但既有紀錄的 doc_type 還存著那四個值，沒有它們，
 * 歷史紀錄的「類型」欄就是一排認不得的英文。
 *
 * 這是**顯示名**對照，與報名 answers 的 key→中文無關（那一份唯一來源是 form_schemas）。
 */
const DOC_TYPE_LABEL: Record<string, string> = {
  ...Object.fromEntries(Object.entries(DOC_TYPE_KEYS).map(([label, key]) => [key, label])),
  session_summary: '場次摘要',
  attendance_sheet: '簽到清單',
  followup_notes: '追蹤重點',
  monthly_report: '月度摘要',
};
const docTypeText = (key: string) => DOC_TYPE_LABEL[key] ?? key;

/**
 * `generate-document` 回的錯誤碼 → 中文。
 *
 * Edge Function 一律回大寫代碼（有幾個後面接冒號與說明），前端原樣 setError 就等於
 * 把 `NO_MATERIAL` 丟到使用者臉上——他既不知道發生什麼，也不知道下一步該做什麼。
 * 認不得的訊息原樣顯示：亂猜一句中文會蓋掉真正的錯誤內容。
 */
const DOC_ERROR_TEXT: Record<string, string> = {
  UNAUTHORIZED: '登入狀態已失效，請重新登入後再試。',
  FORBIDDEN: '這個帳號沒有文件生成權限。',
  UNKNOWN_DOC_TYPE: '認不得的文件類型，請重選一次類型。',
  INSTRUCTION_REQUIRED: '「自訂需求」要先在補充指示寫一句話說明你要什麼，Claude 才知道要產什麼。',
  SESSION_REQUIRED: '這一型必須選定單一場次——它寫的是那一場的內容。',
  NO_MATERIAL: '這個範圍內沒有可用的素材（沒有場次或報名資料），產不出草稿。',
  ANTHROPIC_KEY_MISSING: '尚未設定 Anthropic 金鑰（Supabase secrets 的 ANTHROPIC_API_KEY）。',
  MODEL_REFUSED: '模型婉拒了這次生成，請調整補充指示後再試。',
  EMPTY_RESULT: '模型回了空白內容，沒有草稿可存，請再試一次。',
  METHOD_NOT_ALLOWED: '呼叫方式不正確，請重新整理頁面後再試。',
};
/** 代碼可能帶「碼：說明」，所以取冒號前那一段來比對（全形半形都算）。 */
function docErrorText(message: string) {
  const code = message.split(/[：:]/)[0].trim();
  const text = DOC_ERROR_TEXT[code];
  return text ? `${text}（${code}）` : message;
}

export default function DocumentsPage() {
  const [sessions, setSessions] = useState<SessionSlot[]>([]); const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<ContactGroupRecord[]>([]); const [documents, setDocuments] = useState<GeneratedDocumentRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]); const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string>(); const [notice, setNotice] = useState<string>();
  const [docType, setDocType] = useState(DOC_TYPES[0]); const [scope, setScope] = useState('all-h2'); const [note, setNote] = useState('');
  const [bulk, setBulk] = useState({ groupIds: [] as string[], includeIds: [] as string[], excludeIds: [] as string[], sessionId: '', templateId: '', subject: '', body: '' });
  const [sending, setSending] = useState(false); const [confirming, setConfirming] = useState(false);
  /** 生成的兩段式：先拿 willSend（不呼叫 API），使用者看過才真的產。 */
  const [genPreview, setGenPreview] = useState<{ willSend: string; redactedNames: number; model: string }>();
  const [generating, setGenerating] = useState(false);
  /** 生成紀錄的全文檢視。 */
  const [viewing, setViewing] = useState<GeneratedDocumentRecord>();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [searchParams] = useSearchParams();
  const [paramNotice, setParamNotice] = useState<string>();
  const bulkRef = useRef<HTMLElement>(null);
  const paramsApplied = useRef(false);

  const docKey = DOC_TYPE_KEYS[docType];
  /** 能不能綁單一場次：不能的那三型連選單都不給，免得選了不算數。 */
  const sessionCapable = !AGGREGATE_ONLY_KEYS.includes(docKey);
  const sessionId = sessionCapable && scope !== 'all-h2' ? scope : undefined;
  /**
   * 停用預覽的理由。這兩型不是「產出比較差」，是根本產不出來——
   * 行前提醒信沒有場次就沒有收件的那群人；自訂需求沒有指示就沒有要求可依。
   */
  const blockReason = docKey === 'pre_event_reminder' && !sessionId
    ? '行前提醒信必須選定單一場次——它是寄給那一場報名者的信'
    : docKey === 'event_plan' && !sessionId
      ? '活動計畫書必須選定單一場次——它寫的是那一場活動的計畫'
      : docKey === 'custom' && !note.trim()
        ? '自訂需求要先在「補充指示」寫一句話說明你要什麼，Claude 才知道要產什麼'
        : '';

  const previewGeneration = async () => {
    setGenerating(true); setError(undefined); setNotice(undefined);
    try {
      const result = await invokeGenerateDocument({ docType: docKey, sessionId, instruction: note, preview: true });
      setGenPreview({ willSend: result.willSend ?? '', redactedNames: result.redactedNames ?? 0, model: result.model ?? '' });
    } catch (e) { setError(e instanceof Error ? docErrorText(e.message) : '預覽失敗'); }
    finally { setGenerating(false); }
  };
  const runGeneration = async () => {
    setGenerating(true); setError(undefined);
    try {
      const result = await invokeGenerateDocument({ docType: docKey, sessionId, instruction: note });
      setGenPreview(undefined);
      await reload();
      setNotice(`草稿已產生（去識別化 ${result.redactedNames ?? 0} 個姓名）。狀態為「draft」，要寄出請自行審閱後從報名工作台或群發區操作——AI 不會自己寄。`);
    } catch (e) { setError(e instanceof Error ? docErrorText(e.message) : '生成失敗'); }
    finally { setGenerating(false); }
  };
  const copyAll = async (text: string) => {
    // 瀏覽器拒絕存取剪貼簿時要講出來，不能靜默失敗讓按鈕看起來是壞的。
    try { await navigator.clipboard.writeText(text); setCopyState('copied'); }
    catch { setCopyState('failed'); }
    setTimeout(() => setCopyState('idle'), 1800);
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
  // 群發跨服務線，沒有「目前這一線」可排最前，所以不傳 currentSlug——通用組排第一。
  const templateGroups = useMemo(() => groupTemplates(templates, projects), [templates, projects]);
  /**
   * 選擇器接真實場次。已完成／已取消的不列入產生範圍。
   * 也排除**已經結束但還沒被轉成 done 的**場次：轉 done 是後台的手動動作，沒有任何
   * 自動機制會做，所以辦完卻忘了轉的場次會一直留在這份清單裡。這在歷史報名回填之後
   * 特別要緊——那些舊場次從此有名冊了，選到它就是把整場舊名單重新寄一次行前提醒。
   */
  const scopeOptions = useMemo(() => {
    const now = Date.now();
    return sessions.filter((session) => session.status !== 'done' && session.status !== 'cancelled'
      && !(session.endsAt && new Date(session.endsAt).getTime() < now));
  }, [sessions]);

  /**
   * 從別頁帶過來的來意：`?session=` 預選場次與群發名單、`?type=` 預選文件類型、`?bulk=1` 直接捲到群發區。
   * 場次要等 `scopeOptions` 算得出來才判斷得了在不在範圍內，所以綁在 loading 結束那一刻跑一次。
   * 不在範圍內的（已結束、已取消）不靜靜忽略——那會讓人以為連結沒作用，或更糟：以為它選到了。
   */
  useEffect(() => {
    if (loading || paramsApplied.current) return;
    paramsApplied.current = true;
    const type = searchParams.get('type');
    if (type) {
      const label = DOC_TYPES.find((item) => item === type || DOC_TYPE_KEYS[item] === type);
      if (label) setDocType(label);
    }
    const session = searchParams.get('session');
    if (session) {
      if (scopeOptions.some((item) => item.id === session)) {
        setScope(session);
        setBulk((current) => ({ ...current, sessionId: session }));
      } else {
        setParamNotice('這個場次已結束，已自動排除於產生與群發範圍');
      }
    }
    if (searchParams.get('bulk') === '1') bulkRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loading, scopeOptions, searchParams]);

  /**
   * 生成紀錄的「範圍」欄。舊版直接印 `scope` 欄位（`single`／`aggregate`），
   * 看到的是資料庫用語而不是「哪一場」。單一場次用頁內已有的 sessions 對映成場次名；
   * 彙整型印它的統計區間。對不到（場次已刪）就退回原始 target_id，不是留白。
   */
  const scopeText = (document: GeneratedDocumentRecord) => {
    if (document.scope !== 'single') return document.targetId || '跨場次彙整';
    const session = sessions.find((item) => item.id === document.targetId);
    if (!session) return document.targetId ? `場次 ${document.targetId.slice(0, 8)}…（已不在清單中）` : '單一場次';
    return `${projectName.get(session.projectId) ?? '—'}｜${sessionDateText(session.startsAt)} ${sessionTimeText(session.startsAt)}`;
  };

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
    {paramNotice ? <OpsNotice tone="warning">{paramNotice}</OpsNotice> : null}

    <article className="ops-panel">
      <div className="ops-panel-header"><div><h2>產生設定</h2><p>流程：選類型 → 選範圍 → <b>看過將送出的資料</b> → Claude 產草稿 → 你全文審閱 → 寄出或匯出。AI 永不自行寄出。</p></div></div>
      <div className="ops-form-grid">
        <Select label="文件類型" value={docType} onChange={(e) => setDocType(e.target.value)}>
          {DOC_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </Select>
        <Select
          label="場次／範圍"
          value={sessionCapable ? scope : 'all-h2'}
          disabled={!sessionCapable}
          helpText={sessionCapable ? undefined : '這類文件一律跨場次彙整，沒有單一場次可選。'}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="all-h2">{sessionCapable ? '整個下半年（跨場次彙整）' : '跨場次彙整'}</option>
          {sessionCapable ? scopeOptions.map((session) => <option key={session.id} value={session.id}>
            {projectName.get(session.projectId) ?? '—'}｜{sessionDateText(session.startsAt)} {sessionTimeText(session.startsAt)}
          </option>) : null}
        </Select>
        <TextInput
          label={docKey === 'custom' ? '補充指示（必填）' : '補充指示（選填）'}
          placeholder={docKey === 'custom' ? '用一句話說明你要什麼，例：寫一封給合作單位的場地借用說明' : '例：語氣輕鬆、強調可當天直接參加'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {/* 收件對象下拉已移除：它從來沒有被送進生成呼叫，選什麼對產出零影響。 */}
      <OpsNotice tone="info">文件一律先產草稿；要寄給誰，到下方範本群發區選名單</OpsNotice>
      {blockReason ? <OpsNotice tone="warning">{blockReason}</OpsNotice> : null}
      <div className="ops-button-row">
        {genPreview
          ? <>
            <WarmButton disabled={generating} onClick={() => void runGeneration()}>{generating ? '生成中…' : '確認送出並產生草稿'}</WarmButton>
            <WarmButton variant="secondary" disabled={generating} onClick={() => setGenPreview(undefined)}>取消</WarmButton>
          </>
          : <WarmButton disabled={generating || Boolean(blockReason)} onClick={() => void previewGeneration()}>{generating ? '準備中…' : '🤖 檢視將送出的資料'}</WarmButton>}
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

    <article className="ops-panel" ref={bulkRef}>
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
          // 選定場次時，該場的「場次／時段／Meet連結」對這批收件人是**同一個值**，群發語境完全合法；
          // buildBulkContext 當年沒有場次語境所以沒提供，這裡在呼叫端補上，不動那個函式本體。
          // 沒選場次時三個變數留白 → applyTemplate 把 {{...}} 原樣留著 → 殘留變數守門擋下寄出，那是對的。
          const bulkSession = sessions.find((item) => item.id === bulk.sessionId);
          const context = {
            ...buildBulkContext(sessions, `${location.origin}${import.meta.env.BASE_URL}`),
            ...(bulkSession ? {
              場次: bulkSession.title,
              時段: `${sessionDateText(bulkSession.startsAt)} ${sessionTimeText(bulkSession.startsAt)}–${sessionTimeText(bulkSession.endsAt)}`,
              Meet連結: bulkSession.meetUrl ?? '',
            } : {}),
          };
          setBulk({
            ...bulk, templateId: e.target.value,
            subject: template ? applyTemplate(template.subject, context).text : bulk.subject,
            body: template ? applyTemplate(template.body, context).text : bulk.body,
          });
        }}>
          <option value="">不套範本，自己寫</option>
          {templateGroups.map((group) => <optgroup key={group.label} label={group.label}>
            {group.items.map((template) => <option key={template.id} value={template.id}>{template.name}{template.reviewStatus === 'draft' ? '（待審閱）' : ''}</option>)}
          </optgroup>)}
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
      <div className="ops-panel-header"><div><h2>🗂 生成紀錄</h2><p>已產生的文件會列在這裡，含類型、範圍與是否已寄出。點「檢視」看全文。</p></div></div>
      {documents.length ? <div className="ops-table-wrap"><table className="ops-table">
        <thead><tr><th>文件</th><th>類型</th><th>範圍</th><th>狀態</th><th>產生時間</th><th /></tr></thead>
        <tbody>{documents.map((document) => <tr key={document.id}>
          <td><strong>{document.title || '（未命名）'}</strong></td>
          <td><span className="ops-cell-muted">{docTypeText(document.docType)}</span></td>
          <td><span className="ops-cell-muted">{scopeText(document)}</span></td>
          <td><span className="ops-status ops-status--gray">{document.status}</span></td>
          <td><span className="ops-cell-muted">{new Date(document.createdAt).toLocaleString('zh-TW')}</span></td>
          <td><button type="button" className="ops-link-button" onClick={() => { setCopyState('idle'); setViewing(document); }}>檢視</button></td>
        </tr>)}</tbody>
      </table></div> : <EmptyPanel title="還沒有任何生成紀錄" description="還沒有生成過任何文件，用下面的表單產一份草稿。" />}
    </article>

    {/* 生成紀錄以前只看得到標題與狀態，看不到內容——一份審不了的草稿等於沒產出。 */}
    {viewing ? <><div className="ops-drawer-backdrop" onClick={() => setViewing(undefined)} />
      <aside className="ops-drawer">
        <header className="ops-drawer-head">
          <div>
            <p className="ops-eyebrow">{docTypeText(viewing.docType)}・{scopeText(viewing)}</p>
            <h2>{viewing.title || '（未命名）'}</h2>
            <p>{viewing.status}・{new Date(viewing.createdAt).toLocaleString('zh-TW')}{viewing.redacted ? '・已去識別化' : ''}</p>
          </div>
          <button type="button" className="ops-link-button" onClick={() => setViewing(undefined)}>✕ 關閉</button>
        </header>
        <div className="ops-drawer-body">
          <article className="ops-panel">
            <div className="ops-button-row">
              <WarmButton variant="secondary" onClick={() => void copyAll(viewing.content)}>
                {copyState === 'copied' ? '已複製' : copyState === 'failed' ? '請手動複製' : '複製全文'}
              </WarmButton>
            </div>
            {viewing.content
              ? <pre className="ops-willsend ops-willsend--full">{viewing.content}</pre>
              : <EmptyPanel title="這筆紀錄沒有內容" description="草稿內容是空的——可能是生成當時就沒有存進來。" />}
          </article>
        </div>
      </aside></> : null}
  </section>;
}
