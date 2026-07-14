/**
 * 個案管理路由頁。【CLAUDE 整合層】
 * 服務紀錄先寫本地狀態；之後改接 Supabase（K1，含 RLS 專案制權限）。
 */
import { useState } from 'react';
import type { ServiceRecord } from '@contracts/types';
import { CaseManagement, mockCases, mockRecords } from '@/features/case-management';
import DemoDataNotice from '../DemoDataNotice';

export default function CasesPage() {
  const [records, setRecords] = useState<Record<string, ServiceRecord[]>>(mockRecords);

  const handleAddRecord = (record: Omit<ServiceRecord, 'id' | 'createdAt'>) => {
    setRecords((prev) => ({
      ...prev,
      [record.caseId]: [
        ...(prev[record.caseId] ?? []),
        { ...record, id: `record-${Date.now()}`, createdAt: new Date().toISOString() },
      ],
    }));
  };

  return (
    <div>
      <DemoDataNotice note="個案資料受個資紀律規範：真實資料只經 CLAUDE 遷移腳本（K4）進入資料庫，絕不進 git。" />
      <CaseManagement cases={mockCases} records={records} onAddRecord={handleAddRecord} />
    </div>
  );
}
