/**
 * 信件範本管理路由頁。【CLAUDE 整合層】
 * 範本 CRUD 先寫本地狀態；之後改接 Supabase（K1）。
 */
import { useState } from 'react';
import type { EmailTemplate } from '@contracts/types';
import { EmailTemplateManager, mockTemplates } from '@/features/email-templates';
import DemoDataNotice from '../DemoDataNotice';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>(mockTemplates);

  const handleSave = (template: EmailTemplate) => {
    setTemplates((prev) => {
      const exists = prev.some((item) => item.id === template.id);
      return exists ? prev.map((item) => (item.id === template.id ? template : item)) : [...prev, template];
    });
  };

  const handleDelete = (template: EmailTemplate) => {
    setTemplates((prev) => prev.filter((item) => item.id !== template.id));
  };

  return (
    <div>
      <DemoDataNotice />
      <EmailTemplateManager templates={templates} onSave={handleSave} onDelete={handleDelete} />
    </div>
  );
}
