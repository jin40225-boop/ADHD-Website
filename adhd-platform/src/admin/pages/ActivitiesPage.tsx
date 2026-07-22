import { useEffect, useMemo, useState } from 'react';
import { adminListProjects } from '@/lib/api';
import type { Project } from '@contracts/types';
import { listActivities, saveActivity } from '../operations/api';
import type { ActivityRecord } from '../operations/types';
import { TextInput, Textarea, Select } from '@/components/ui/FormField/FormField';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { EmptyPanel, InlineSpinner, OpsNotice, PageHeader, StatusPill } from '../operations/components';

const blank = (): Partial<ActivityRecord> => ({ status: 'draft', name: '', publicSummary: '' });
export default function ActivitiesPage() {
  const [items, setItems] = useState<ActivityRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [draft, setDraft] = useState<Partial<ActivityRecord>>(blank());
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const reload = () => Promise.all([listActivities(), adminListProjects()]).then(([a, p]) => { setItems(a); setProjects(p); if (!draft.projectId && p[0]) setDraft((v) => ({ ...v, projectId: p[0].id })); });
  useEffect(() => { reload().catch((e: unknown) => setError(e instanceof Error ? e.message : '讀取活動失敗')).finally(() => setLoading(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = useMemo(() => draft.id ? items.find((item) => item.id === draft.id) : undefined, [draft.id, items]);
  const edit = (item?: ActivityRecord) => setDraft(item ? { ...item } : { ...blank(), projectId: projects[0]?.id });
  const submit = async () => {
    if (!draft.projectId || !draft.name?.trim()) { setError('請選擇計畫並填寫活動名稱。'); return; }
    setError(undefined); setNotice(undefined);
    try {
      await saveActivity({ id: draft.id, projectId: draft.projectId, projectName: draft.projectName, name: draft.name, status: draft.status ?? 'draft', publicSummary: draft.publicSummary, startsAt: draft.startsAt, endsAt: draft.endsAt, sessionCount: draft.sessionCount });
      await reload(); setNotice(draft.id ? '活動已更新。' : '活動已建立，可繼續建立場次與報名表。'); edit();
    } catch (e) { setError(e instanceof Error ? e.message : '儲存活動失敗'); }
  };
  return <section className="ops-section">
    <PageHeader eyebrow="活動生命週期" title="活動管理" description="活動是場次、表單、報名、講師與後續追蹤的共同容器。" actions={<WarmButton onClick={() => edit()}>＋ 新增活動</WarmButton>} />
    {notice ? <OpsNotice tone="success">{notice}</OpsNotice> : null}{error ? <OpsNotice tone="danger">{error}</OpsNotice> : null}
    {loading ? <InlineSpinner /> : <div className="ops-grid ops-grid--2">
      <article className="ops-panel ops-panel--flush"><div className="ops-panel-header"><h2>活動清單</h2><span>{items.length} 筆</span></div>
        {items.length ? <div className="ops-list">{items.map((item) => <button type="button" className="ops-list-button" key={item.id} onClick={() => edit(item)}><div><strong>{item.name}</strong><p>{item.projectName} · {item.sessionCount ?? 0} 個場次</p></div><StatusPill tone={item.status === 'published' ? 'green' : item.status === 'cancelled' ? 'red' : 'gray'}>{item.status}</StatusPill></button>)}</div> : <EmptyPanel title="尚未建立活動" />}
      </article>
      <article className="ops-panel"><div className="ops-panel-header"><div><p className="ops-eyebrow">{selected ? '編輯' : '建立'}</p><h2>活動基本資料</h2></div></div>
        <div className="ops-form-grid"><Select label="所屬計畫" value={draft.projectId ?? ''} onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}><option value="">請選擇</option>{projects.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</Select><Select label="狀態" value={draft.status ?? 'draft'} onChange={(e) => setDraft({ ...draft, status: e.target.value as ActivityRecord['status'] })}><option value="draft">草稿</option><option value="published">已公開</option><option value="closed">停止報名</option><option value="completed">已完成</option><option value="cancelled">已取消</option></Select><TextInput label="活動名稱" value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /><TextInput label="開始時間" type="datetime-local" value={draft.startsAt?.slice(0, 16) ?? ''} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /><TextInput label="結束時間" type="datetime-local" value={draft.endsAt?.slice(0, 16) ?? ''} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /><div className="ops-full"><Textarea label="公開摘要" rows={5} value={draft.publicSummary ?? ''} onChange={(e) => setDraft({ ...draft, publicSummary: e.target.value })} /></div></div>
        <div className="ops-button-row"><WarmButton onClick={submit}>儲存活動</WarmButton></div>
      </article>
    </div>}
  </section>;
}
