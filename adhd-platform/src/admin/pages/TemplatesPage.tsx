/** 信件範本管理：已連線時使用 Supabase CRUD；未設定時保留示意資料。 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EmailTemplate, Project } from '@contracts/types';
import { EmailTemplateManager, mockTemplates } from '@/features/email-templates';
import {
  adminDeleteEmailTemplate,
  adminListEmailTemplates,
  adminListProjects,
  adminSaveEmailTemplate,
} from '@/lib/api';
import { isSupabaseReady } from '@/lib/supabase';
import DemoDataNotice from '../DemoDataNotice';
import { InlineSpinner, OpsNotice, PageHeader } from '../operations/components';
import { groupTemplates } from '../operations/templateGroups';

export default function TemplatesPage() {
  const live = isSupabaseReady;
  const [templates, setTemplates] = useState<EmailTemplate[]>(live ? [] : mockTemplates);
  // 分組標題要顯示服務線的名稱，所以清單頁也得知道有哪些專案。讀不到專案不算錯誤——
  // groupTemplates 會把全部範本歸到「通用範本」，清單只是不分組，不會有範本消失。
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(live);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    if (!live) return;
    try {
      const [nextTemplates, nextProjects] = await Promise.all([adminListEmailTemplates(), adminListProjects()]);
      setTemplates(nextTemplates);
      setProjects(nextProjects);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取信件範本失敗');
    } finally {
      setLoading(false);
    }
  }, [live]);

  const groups = useMemo(() => groupTemplates(templates, projects), [templates, projects]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSave = async (template: EmailTemplate) => {
    setNotice(undefined);
    setError(undefined);
    if (!live) {
      setTemplates((prev) => {
        const exists = prev.some((item) => item.id === template.id);
        return exists ? prev.map((item) => (item.id === template.id ? template : item)) : [...prev, template];
      });
      setNotice('示意模式：變更只保留在目前瀏覽器工作階段。');
      return;
    }
    if (!template.name.trim()) {
      setError('範本名稱不可空白。');
      return;
    }
    try {
      const saved = await adminSaveEmailTemplate(template);
      setTemplates((prev) => {
        const withoutDraft = prev.filter((item) => item.id !== template.id && item.id !== saved.id);
        return [...withoutDraft, saved].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
      });
      setNotice(`「${saved.name}」已儲存至資料庫。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存範本失敗');
    }
  };

  const handleDelete = async (template: EmailTemplate) => {
    setNotice(undefined);
    setError(undefined);
    if (!live || template.id.startsWith('draft-')) {
      setTemplates((prev) => prev.filter((item) => item.id !== template.id));
      if (!live) setNotice('示意模式：範本已從目前畫面移除。');
      return;
    }
    // 確認已由 EmailTemplateManager 以站內兩段式按鈕完成，不再用 window.confirm。
    try {
      await adminDeleteEmailTemplate(template.id);
      setTemplates((prev) => prev.filter((item) => item.id !== template.id));
      setNotice(`「${template.name}」已刪除。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除範本失敗');
    }
  };

  return (
    <section className="ops-section">
      <PageHeader eyebrow="活動營運" title="信件範本" description="建立與維護對外信件範本；已連線資料庫時，新增、編輯與刪除都直接寫回 Supabase。" />
      {live ? (
        <OpsNotice tone="info"><strong>真實資料模式</strong>：範本新增、編輯與刪除皆受 Supabase RLS 權限保護。</OpsNotice>
      ) : <DemoDataNotice />}
      {notice ? <OpsNotice tone="success" role="status">{notice}</OpsNotice> : null}
      {error ? <OpsNotice tone="danger" role="alert">{error}</OpsNotice> : null}
      {loading ? <InlineSpinner label="載入信件範本中…" /> : (
        <article className="ops-panel">
          <EmailTemplateManager key={templates.map((item) => item.id).join('|')} templates={templates} groups={groups} onSave={handleSave} onDelete={handleDelete} />
        </article>
      )}
    </section>
  );
}
