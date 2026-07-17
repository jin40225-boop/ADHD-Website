/**
 * 報名表編輯器路由頁。【CLAUDE 整合層】
 * 選專案 → SchemaFormEditor（CODEX form-engine，含即時預覽）→ 儲存回 form_schemas。
 * RLS：owner／admin_collab／系統擁有者可寫；前台 RegisterPage 讀同一份定義即刻生效。
 */
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import type { FormSchema, Project } from '@contracts/types';
import { SchemaFormEditor } from '@/features/form-engine';
import { ApiError, adminListProjects, adminSaveFormSchema, getFormSchema } from '@/lib/api';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/FormField';
import { WarmButton } from '@/components/ui/WarmButton';

export default function FormsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    (async () => {
      try {
        const rows = await adminListProjects();
        setProjects(rows);
        if (rows.length) setProjectId(rows[0].id);
      } catch (err) {
        setError(
          err instanceof ApiError && err.code === 'NOT_READY'
            ? 'Supabase 未設定：表單編輯器需連線資料庫才能使用。'
            : err instanceof Error ? err.message : '載入專案清單失敗',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      setSchemaLoading(true);
      setNotice(undefined);
      setError(undefined);
      try {
        const loaded = await getFormSchema(projectId);
        if (cancelled) return;
        setSchema(loaded ?? { projectId, fields: [] });
        setDirty(false);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '載入表單定義失敗');
      } finally {
        if (!cancelled) setSchemaLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const handleSave = async () => {
    if (!schema) return;
    const emptyKeys = schema.fields.filter((f) => !f.key.trim() || !f.label.trim());
    if (emptyKeys.length) {
      setError('每個欄位都需要「欄位名稱」與「欄位識別碼」，請補齊後再儲存。');
      return;
    }
    const keys = schema.fields.map((f) => f.key.trim());
    if (new Set(keys).size !== keys.length) {
      setError('欄位識別碼重複，請確認每個欄位的 key 唯一。');
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const saved = await adminSaveFormSchema(projectId, schema.fields);
      setSchema(saved);
      setDirty(false);
      setNotice('已儲存。前台報名頁即刻採用新欄位定義。');
    } catch (err) {
      setError(`儲存失敗：${err instanceof Error ? err.message : '未知錯誤'}（請確認已以管理者帳號登入）`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="載入專案清單…" />;
  if (!projects.length) {
    return <EmptyState title="沒有可編輯的專案" description={error ?? '請先於資料庫建立專案。'} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-64">
          <Select
            label="選擇專案報名表"
            name="form-project"
            value={projectId}
            onChange={(event) => {
              if (dirty && !window.confirm('尚未儲存的變更將遺失，確定切換專案？')) return;
              setProjectId(event.target.value);
            }}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
        <WarmButton icon={Save} disabled={!dirty || saving || schemaLoading} onClick={handleSave}>
          {saving ? '儲存中…' : dirty ? '儲存變更' : '已是最新'}
        </WarmButton>
      </div>
      {notice ? (
        <p role="status" className="mb-4 rounded-xl border-2 border-brown/40 bg-accent-blue/30 px-4 py-2.5 text-sm">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 rounded-xl border-2 border-highlight bg-accent-orange/25 px-4 py-2.5 text-sm font-bold">
          {error}
        </p>
      ) : null}
      {schemaLoading || !schema ? (
        <LoadingState label="載入表單定義…" />
      ) : (
        <SchemaFormEditor
          value={schema}
          onChange={(next) => { setSchema(next); setDirty(true); setNotice(undefined); }}
        />
      )}
    </div>
  );
}
