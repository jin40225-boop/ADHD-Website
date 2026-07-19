/** 個案管理：僅讀寫 RLS 授權的 cases／service_records；離線時使用去識別示意資料。 */
import { useCallback, useEffect, useState } from 'react';
import type { Case, ServiceRecord } from '@contracts/types';
import { CaseManagement, mockCases, mockRecords } from '@/features/case-management';
import { adminAddServiceRecord, adminListCasesWithRecords } from '@/lib/api';
import { isSupabaseReady } from '@/lib/supabase';
import DemoDataNotice from '../DemoDataNotice';

export default function CasesPage() {
  const live = isSupabaseReady;
  const [cases, setCases] = useState<Case[]>(live ? [] : mockCases);
  const [records, setRecords] = useState<Record<string, ServiceRecord[]>>(live ? {} : mockRecords);
  const [loading, setLoading] = useState(live);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    if (!live) return;
    try {
      const result = await adminListCasesWithRecords();
      setCases(result.cases);
      setRecords(result.records);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取個案資料失敗');
    } finally {
      setLoading(false);
    }
  }, [live]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleAddRecord = async (record: Omit<ServiceRecord, 'id' | 'createdAt'>) => {
    setNotice(undefined);
    setError(undefined);
    if (!live) {
      setRecords((prev) => ({
        ...prev,
        [record.caseId]: [
          ...(prev[record.caseId] ?? []),
          { ...record, id: `record-${Date.now()}`, createdAt: new Date().toISOString() },
        ],
      }));
      setNotice('示意模式：紀錄只保留在目前瀏覽器工作階段。');
      return;
    }
    try {
      const saved = await adminAddServiceRecord(record);
      setRecords((prev) => ({
        ...prev,
        [saved.caseId]: [saved, ...(prev[saved.caseId] ?? [])],
      }));
      setNotice(`「${saved.title}」已寫入受權限保護的服務紀錄。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增服務紀錄失敗');
    }
  };

  return (
    <div>
      {live ? (
        <p className="mb-4 rounded-xl border-2 border-brown/40 bg-accent-teal/20 px-4 py-2.5 text-sm">
          <strong>受保護資料模式</strong>：畫面只會顯示目前帳號依專案權限可存取的個案；內容不進入 git。
        </p>
      ) : (
        <DemoDataNotice note="個案資料受個資紀律規範：離線只顯示假資料，真實資料僅存於受 RLS 保護的 Supabase。" />
      )}
      {notice ? <p role="status" className="mb-4 rounded-xl border-2 border-brown/40 bg-accent-blue/30 px-4 py-2.5 text-sm">{notice}</p> : null}
      {error ? <p role="alert" className="mb-4 rounded-xl border-2 border-alert-red bg-alert-red/10 px-4 py-2.5 text-sm font-bold">{error}</p> : null}
      {loading ? <p className="p-6 text-center text-brown/60">載入個案資料中…</p> : (
        <CaseManagement cases={cases} records={records} onAddRecord={handleAddRecord} />
      )}
    </div>
  );
}