/** 信件範本管理：已連線時使用 Supabase CRUD；未設定時保留示意資料。 */
import { useCallback, useEffect, useState } from 'react';
import type { EmailTemplate } from '@contracts/types';
import { EmailTemplateManager, mockTemplates } from '@/features/email-templates';
import {
  adminDeleteEmailTemplate,
  adminListEmailTemplates,
  adminSaveEmailTemplate,
} from '@/lib/api';
import { isSupabaseReady } from '@/lib/supabase';
import DemoDataNotice from '../DemoDataNotice';

export default function TemplatesPage() {
  const live = isSupabaseReady;
  const [templates, setTemplates] = useState<EmailTemplate[]>(live ? [] : mockTemplates);
  const [loading, setLoading] = useState(live);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    if (!live) return;
    try {
      setTemplates(await adminListEmailTemplates());
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取信件範本失敗');
    } finally {
      setLoading(false);
    }
  }, [live]);

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
    if (!window.confirm(`確定刪除信件範本「${template.name}」？此動作無法復原。`)) return;
    try {
      await adminDeleteEmailTemplate(template.id);
      setTemplates((prev) => prev.filter((item) => item.id !== template.id));
      setNotice(`「${template.name}」已刪除。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除範本失敗');
    }
  };

  return (
    <div>
      {live ? (
        <p className="mb-4 rounded-xl border-2 border-brown/40 bg-accent-teal/20 px-4 py-2.5 text-sm">
          <strong>真實資料模式</strong>：範本新增、編輯與刪除皆受 Supabase RLS 權限保護。
        </p>
      ) : <DemoDataNotice />}
      {notice ? <p role="status" className="mb-4 rounded-xl border-2 border-brown/40 bg-accent-blue/30 px-4 py-2.5 text-sm">{notice}</p> : null}
      {error ? <p role="alert" className="mb-4 rounded-xl border-2 border-alert-red bg-alert-red/10 px-4 py-2.5 text-sm font-bold">{error}</p> : null}
      {loading ? <p className="p-6 text-center text-brown/60">載入信件範本中…</p> : (
        <EmailTemplateManager key={templates.map((item) => item.id).join('|')} templates={templates} onSave={handleSave} onDelete={handleDelete} />
      )}
    </div>
  );
}