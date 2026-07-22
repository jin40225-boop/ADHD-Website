import { useEffect, useMemo, useState } from 'react';
import { listAuditRecords } from '../operations/api';
import type { AuditRecord } from '../operations/types';
import { TextInput, Select } from '@/components/ui/FormField/FormField';
import { EmptyPanel, InlineSpinner, OpsNotice, PageHeader, StatusPill } from '../operations/components';

export default function AuditPage() {
  const [items, setItems] = useState<AuditRecord[]>([]); const [search, setSearch] = useState(''); const [result, setResult] = useState('all'); const [loading, setLoading] = useState(true); const [error, setError] = useState<string>();
  useEffect(() => { listAuditRecords().then(setItems).catch((e: unknown) => setError(e instanceof Error ? e.message : '讀取稽核紀錄失敗')).finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => items.filter((item) => (result === 'all' || item.result === result) && `${item.action} ${item.targetType} ${item.targetId} ${item.detail}`.toLowerCase().includes(search.toLowerCase())), [items, result, search]);
  return <section className="ops-section"><PageHeader eyebrow="可稽核作業" title="異動紀錄" description="追蹤重要行政操作、外部整合結果與資料異動對象。" />{error ? <OpsNotice tone="danger">{error}</OpsNotice> : null}<div className="ops-toolbar"><TextInput label="搜尋" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="操作、對象或說明" /><Select label="結果" value={result} onChange={(e) => setResult(e.target.value)}><option value="all">全部</option><option value="success">成功</option><option value="error">失敗</option></Select></div>{loading ? <InlineSpinner /> : <article className="ops-panel ops-panel--flush">{filtered.length ? <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>時間</th><th>操作</th><th>對象</th><th>結果</th><th>說明</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString('zh-TW')}</td><td><strong>{item.action}</strong></td><td>{item.targetType || '—'}<small>{item.targetId}</small></td><td><StatusPill tone={item.result === 'success' ? 'green' : 'red'}>{item.result}</StatusPill></td><td>{item.detail || '—'}</td></tr>)}</tbody></table></div> : <EmptyPanel title="沒有符合條件的紀錄" />}</article>}</section>;
}
