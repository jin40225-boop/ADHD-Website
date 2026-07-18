/**
 * 活動回饋後台。【CLAUDE】
 * 列出 event_feedback 全部留言（最新在前）；可刪除。RLS 限系統擁有者可讀。
 * Supabase 未設定時顯示離線提示（無示意資料）。
 */
import { useCallback, useEffect, useState } from 'react';
import type { EventFeedback } from '@contracts/types';
import { DataTable } from '@/components/ui';
import type { DataTableColumn } from '@/components/ui';
import { adminDeleteFeedback, adminListFeedback } from '@/lib/api';
import { isSupabaseReady } from '@/lib/supabase';

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function FeedbackPage() {
  const live = isSupabaseReady;
  const [rows, setRows] = useState<EventFeedback[]>([]);
  const [loading, setLoading] = useState(live);
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    if (!live) return;
    try {
      setRows(await adminListFeedback());
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入回饋資料失敗');
    } finally {
      setLoading(false);
    }
  }, [live]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleDelete = async (row: EventFeedback) => {
    if (!window.confirm(`確定刪除 ${row.name} 的這則回饋？此動作無法復原。`)) return;
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== row.id)); // 樂觀更新
    try {
      await adminDeleteFeedback(row.id);
    } catch (err) {
      setRows(prev); // 還原
      setError(err instanceof Error ? err.message : '刪除失敗');
    }
  };

  const columns: DataTableColumn<EventFeedback>[] = [
    {
      id: 'created_at',
      header: '時間',
      cell: (r) => <span className="whitespace-nowrap text-brown/70">{formatDate(r.createdAt)}</span>,
      sortValue: (r) => r.createdAt,
    },
    { id: 'event', header: '活動', cell: (r) => r.eventName || <span className="text-brown/40">—</span>, sortValue: (r) => r.eventName ?? '' },
    { id: 'name', header: '姓名', cell: (r) => r.name, sortValue: (r) => r.name },
    {
      id: 'email',
      header: '信箱',
      cell: (r) =>
        r.email ? (
          <a href={`mailto:${r.email}`} className="text-line-green underline">{r.email}</a>
        ) : (
          <span className="text-brown/40">—</span>
        ),
    },
    { id: 'message', header: '回饋留言', cell: (r) => <span className="whitespace-pre-wrap">{r.message}</span> },
    {
      id: 'actions',
      header: '',
      cell: (r) => (
        <button
          type="button"
          onClick={() => void handleDelete(r)}
          className="text-alert-red underline text-sm whitespace-nowrap"
        >
          刪除
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            活動回饋{live && !loading && !error ? `（${rows.length} 筆）` : ''}
          </h1>
          <p className="text-sm text-brown/70">民眾透過 /feedback 送出的活動回饋留言，最新在前。</p>
        </div>
        {live ? (
          <button
            type="button"
            onClick={() => void reload()}
            className="ui-button ui-button--sm ui-button--secondary shrink-0"
          >
            重新整理
          </button>
        ) : null}
      </div>

      {!live ? (
        <p className="rounded-xl border-2 border-brown/40 bg-base-yellow/60 px-4 py-3 text-sm">
          目前為離線／骨架模式（未連接 Supabase），無法讀取回饋資料。
        </p>
      ) : error ? (
        <p role="alert" className="mb-4 rounded-xl border-2 border-alert-red bg-alert-red/10 px-4 py-2.5 text-sm font-bold">
          {error}
        </p>
      ) : null}

      {live && loading ? (
        <p className="p-6 text-center text-brown/60">載入回饋資料中…</p>
      ) : live && !error ? (
        <DataTable
          rows={rows}
          columns={columns}
          getRowKey={(r) => r.id}
          pageSize={20}
          emptyTitle="目前還沒有回饋"
          emptyDescription="民眾送出活動回饋後，會顯示在這裡。"
        />
      ) : null}
    </div>
  );
}
