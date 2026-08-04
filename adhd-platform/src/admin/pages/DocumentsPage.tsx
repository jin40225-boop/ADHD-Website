/**
 * 文件產生中心（03_v4）。Phase 6 之前是**佔位頁**：三段選擇器接真實資料、看得到也選得動，
 * 但產出鈕停用並明示 Phase 6 才啟用——比照設定頁的 Claude API 區，不做假生成。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project, SessionSlot } from '@contracts/types';
import { TextInput, Select } from '@/components/ui/FormField/FormField';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { adminListProjects, adminListSessions } from '@/lib/api';
import { listContactGroups, listGeneratedDocuments } from '../operations/api';
import type { ContactGroupRecord, GeneratedDocumentRecord } from '../operations/types';
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
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string>();
  const [docType, setDocType] = useState(DOC_TYPES[0]); const [scope, setScope] = useState('all-h2'); const [audience, setAudience] = useState('none'); const [note, setNote] = useState('');

  useEffect(() => {
    Promise.all([adminListSessions(), adminListProjects(), listContactGroups(), listGeneratedDocuments()])
      .then(([nextSessions, nextProjects, nextGroups, nextDocuments]) => {
        setSessions(nextSessions); setProjects(nextProjects); setGroups(nextGroups); setDocuments(nextDocuments);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '讀取文件中心資料失敗'))
      .finally(() => setLoading(false));
  }, []);

  const projectName = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  /** 選擇器接真實場次，Phase 6 接線時不必再換資料來源。已完成的場次不列入產生範圍。 */
  const scopeOptions = useMemo(() => sessions.filter((session) => session.status !== 'done' && session.status !== 'cancelled'), [sessions]);

  if (loading) return <InlineSpinner />;
  return <section className="ops-section">
    <PageHeader eyebrow="文件" title="📄 文件產生中心" description="只做整合性、集體性的文件。單一報名者的信件在報名工作台的詳情抽屜，單一場次的行政文件在場次詳情。" />
    {error ? <OpsNotice tone="danger">{error}</OpsNotice> : null}

    <OpsNotice tone="warning">
      <b>這一頁的產出功能要到 Phase 6 才啟用。</b>下面的選擇器接的是真實場次與類群、選得動，但「產出草稿」目前是停用的——
      Phase 6 接上 <code>generate-document</code>（Claude API 代理）之後才會真的產生內容。在那之前不做假的產出結果。
    </OpsNotice>

    <article className="ops-panel">
      <div className="ops-panel-header"><div><h2>產生設定</h2><p>Phase 6 的流程：選類型 → 選範圍 → 選對象 → Claude 產草稿 → 你全文審閱 → 寄出或匯出。AI 永不自行寄出。</p></div></div>
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
        <WarmButton disabled onClick={() => {}}>🤖 產出草稿（Phase 6 啟用）</WarmButton>
      </div>
      <OpsNotice tone="info">
        送出前會顯示「將送出哪些資料」清單，且姓名／電話／信箱一律代號化後才送 API（裁決 15，去識別化固定啟用）。
        金鑰在 <Link to="/admin/settings">設定・聯絡人</Link> 的 Claude API 區設定，同樣要到 Phase 6。
      </OpsNotice>
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
      </table></div> : <EmptyPanel title="還沒有任何生成紀錄" description="這是預期的：產出功能於 Phase 6 啟用，在那之前不會有任何東西寫入。" />}
    </article>
  </section>;
}
