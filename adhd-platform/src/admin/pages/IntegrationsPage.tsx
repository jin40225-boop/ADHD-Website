import { useEffect, useState } from 'react';
import { getGmailSyncState, triggerGmailSync } from '../operations/api';
import type { GmailSyncState } from '../operations/types';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { MetricCard, OpsNotice, PageHeader, StatusPill } from '../operations/components';

export default function IntegrationsPage() {
  const [gmail, setGmail] = useState<GmailSyncState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const reload = () => getGmailSyncState().then(setGmail);
  useEffect(() => {
    reload().catch((e: unknown) => setError(e instanceof Error ? e.message : '讀取整合狀態失敗'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sync = async (full: boolean) => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await triggerGmailSync(full);
      // 略過幾封要講出來——那是「收信範圍過濾有沒有在動」的唯一外顯訊號。還有剩的也要講：
      // 那代表這次是時間到了先停下，不是掃完了。
      setNotice([
        `Gmail 同步完成：收進 ${result.synced} 封`,
        result.skipped ? `，範圍外略過 ${result.skipped} 封（未讀取內容）` : '',
        result.remaining ? `，時間用完還剩 ${result.remaining} 封沒掃，再按一次會接著掃` : '',
        '。',
      ].join(''));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gmail 同步失敗');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="ops-section">
      <PageHeader eyebrow="外部服務" title="整合狀態" description="集中檢查 Gmail、Calendar／Meet 與資料庫連線是否形成完整閉環。" />
      {notice ? <OpsNotice tone="success">{notice}</OpsNotice> : null}
      {error ? <OpsNotice tone="danger">{error}</OpsNotice> : null}
      <div className="ops-grid ops-grid--3">
        <MetricCard
          label="Gmail 信箱"
          value={gmail?.mailboxEmail || '尚未同步'}
          detail={gmail?.lastIncrementalSyncAt ? `最近：${new Date(gmail.lastIncrementalSyncAt).toLocaleString('zh-TW')}` : '需要完成首次同步'}
          tone={gmail ? 'green' : 'yellow'}
        />
        <MetricCard
          label="Gmail Watch"
          value={gmail?.watchExpiration ? '已設定' : '待設定'}
          detail={gmail?.watchExpiration
            ? `到期：${new Date(gmail.watchExpiration).toLocaleString('zh-TW')}`
            : '尚未建置 users.watch／Pub/Sub；目前由管理員手動同步'}
          tone={gmail?.watchExpiration ? 'green' : 'yellow'}
        />
        <MetricCard
          label="Calendar / Meet"
          value="隨場次建立"
          detail="請由場次頁執行真實帳號驗收"
          tone="blue"
        />
      </div>
      <article className="ops-panel">
        <div className="ops-panel-header">
          <div>
            <h2>Gmail 雙向同步</h2>
            <p>保存完整收件、寄件、回覆、草稿與同步游標。</p>
          </div>
          <StatusPill tone={gmail?.lastError ? 'red' : gmail ? 'green' : 'yellow'}>
            {gmail?.lastError ? '異常' : gmail ? '可用' : '未初始化'}
          </StatusPill>
        </div>
        {gmail?.lastError ? <OpsNotice tone="danger">{gmail.lastError}</OpsNotice> : null}
        <dl className="ops-kv">
          <div><dt>History ID</dt><dd>{gmail?.historyId || '—'}</dd></div>
          <div><dt>最近完整同步</dt><dd>{gmail?.lastFullSyncAt ? new Date(gmail.lastFullSyncAt).toLocaleString('zh-TW') : '—'}</dd></div>
        </dl>
        <div className="ops-button-row">
          <WarmButton disabled={busy} onClick={() => void sync(false)}>
            {busy ? '同步中…' : '增量同步'}
          </WarmButton>
          <WarmButton variant="secondary" disabled={busy} onClick={() => void sync(true)}>
            完整重建同步
          </WarmButton>
        </div>
      </article>
    </section>
  );
}
