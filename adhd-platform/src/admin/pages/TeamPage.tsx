import { useEffect, useState } from 'react';
import { adminListProjects } from '@/lib/api';
import type { Project } from '@contracts/types';
import { inviteTeamMember, listTeamMembers } from '../operations/api';
import type { TeamMemberRecord } from '../operations/types';
import { TextInput, Select } from '@/components/ui/FormField/FormField';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { EmptyPanel, InlineSpinner, OpsNotice, PageHeader, StatusPill } from '../operations/components';

const ROLE: Record<string, string> = { owner: '系統／計畫擁有者', admin_collab: '行政協作者', instructor_full: '完整講師', instructor_slot: '時段講師' };
export default function TeamPage() {
  const [items, setItems] = useState<TeamMemberRecord[]>([]); const [projects, setProjects] = useState<Project[]>([]); const [projectId, setProjectId] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState<TeamMemberRecord['role']>('admin_collab'); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<string>(); const [error, setError] = useState<string>();
  const reload = async () => { const [members, ps] = await Promise.all([listTeamMembers(), adminListProjects()]); setItems(members); setProjects(ps); setProjectId((current) => current || ps[0]?.id || ''); };
  useEffect(() => { reload().catch((e: unknown) => setError(e instanceof Error ? e.message : '讀取團隊失敗')).finally(() => setLoading(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const invite = async () => { if (!projectId || !email.trim()) { setError('請選擇計畫並輸入 Email。'); return; } setBusy(true); setError(undefined); try { const result = await inviteTeamMember(projectId, email, role); setNotice(result.invited ? '邀請信已寄出，成員權限也已建立。' : '既有帳號已加入計畫並更新角色。'); setEmail(''); await reload(); } catch (e) { setError(e instanceof Error ? e.message : '邀請失敗'); } finally { setBusy(false); } };
  return <section className="ops-section"><PageHeader eyebrow="權限與協作" title="團隊成員" description="直接以 Email 邀請行政與講師；系統自動建立帳號邀請及計畫角色，不必再到資料庫手動處理。" />
    {notice ? <OpsNotice tone="success">{notice}</OpsNotice> : null}{error ? <OpsNotice tone="danger">{error}</OpsNotice> : null}
    <article className="ops-panel"><div className="ops-panel-header"><div><h2>邀請或加入成員</h2><p>若對方已有帳號會直接加入；尚無帳號則寄出登入邀請。</p></div></div><div className="ops-form-grid"><Select label="計畫" value={projectId} onChange={(e) => setProjectId(e.target.value)} options={projects.map((p) => ({ value: p.id, label: p.name }))} /><TextInput type="email" label="成員 Email" value={email} onChange={(e) => setEmail(e.target.value)} /><Select label="角色" value={role} onChange={(e) => setRole(e.target.value as TeamMemberRecord['role'])} options={Object.entries(ROLE).map(([value, label]) => ({ value, label }))} /></div><div className="ops-button-row"><WarmButton disabled={busy} onClick={() => void invite()}>{busy ? '處理中…' : '寄出邀請／加入成員'}</WarmButton></div></article>
    {loading ? <InlineSpinner /> : <article className="ops-panel ops-panel--flush"><div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>成員</th><th>計畫</th><th>角色</th><th>加入日期</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.displayName || item.email || item.userId}</strong><small>{item.email}</small></td><td>{item.projectName}</td><td><StatusPill tone={item.role === 'owner' ? 'blue' : 'gray'}>{ROLE[item.role] ?? item.role}</StatusPill></td><td>{new Date(item.createdAt).toLocaleDateString('zh-TW')}</td></tr>)}</tbody></table></div>{!items.length ? <EmptyPanel title="尚無團隊成員" /> : null}</article>}
  </section>;
}
