import { useEffect, useState } from 'react';
import { getGmailSyncState, triggerGmailSync } from '../operations/api';
import type { GmailSyncState } from '../operations/types';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { MetricCard, OpsNotice, PageHeader, StatusPill } from '../operations/components';

/**
 * 一次「按下同步」最多連續跑幾批。上限不是為了省，是為了不要在對方信箱異常時無限打下去；
 * 沒跑完會明說還剩幾封，再按一次接著做——進度存在資料庫，不會白費。
 */
const MAX_BATCHES = 40;

export default function IntegrationsPage() {
  const [gmail, setGmail] = useState<GmailSyncState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const reload = () => getGmailSyncState().then(setGmail);
  useEffect(() => {
    reload().catch((e: unknown) => setError(e instanceof Error ? e.message : '讀取整合狀態失敗'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /** 先量體、不收信：跑一次搜尋看看會撈到多少，不取信頭、不寫佇列、不推游標、不存任何信件。 */
  const measure = async () => {
    setBusy(true); setError(undefined);
    try {
      const result = await triggerGmailSync(true, true);
      setNotice(`量體結果：搜尋 ${result.knownAddresses ?? 0} 個已知信箱（不含信箱本身）共撈到 ${result.found ?? 0} 筆，去重後 ${result.candidates ?? 0} 封，其中 ${result.newMessages ?? 0} 封還沒收過。沒有動任何資料。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '量體失敗');
    } finally { setBusy(false); }
  };
  const sync = async (full: boolean) => {
    setBusy(true);
    setError(undefined);
    try {
      /* 一次呼叫＝一批（每批最多 5 封）。這裡把批次接連叫完，中間持續回報進度。
       * 分批是因為單次做太多會把函式的記憶體與 CPU 撐爆；接連叫是因為使用者要的是
       * 「按一次就同步完」，不是「按十次」。中途離開這一頁也不會壞：進度存在
       * gmail_sync_state 的佇列裡，下次再按會從剩下的接著做。 */
      let synced = 0; let skipped = 0; let rounds = 0; let remaining = 0;
      do {
        const result = await triggerGmailSync(rounds === 0 ? full : false);
        synced += result.synced ?? 0; skipped += result.skipped ?? 0; remaining = result.remaining ?? 0;
        rounds += 1;
        setNotice(`Gmail 同步中…已收進 ${synced} 封、範圍外略過 ${skipped} 封${remaining ? `，還有 ${remaining} 封排隊中` : ''}。`);
        await reload();
      } while (remaining > 0 && rounds < MAX_BATCHES);
      // 略過幾封要講出來——那是「收信範圍過濾有沒有在動」的唯一外顯訊號。
      setNotice([
        `Gmail 同步完成：收進 ${synced} 封`,
        skipped ? `，範圍外略過 ${skipped} 封（未讀取內容）` : '',
        remaining ? `。還有 ${remaining} 封排隊中——再按一次會接著處理` : '。',
      ].join(''));
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
          {/* 第一次完整同步會撈出好幾個月的歷史往來。先量一次，知道量體再決定要不要開始。 */}
          <WarmButton variant="secondary" disabled={busy} onClick={() => void measure()}>
            先量體（不收信）
          </WarmButton>
        </div>
        <p className="ops-cell-muted">
          「先量體」只跑一次搜尋回報數量，不取信件內容、不寫入任何資料，隨時可按。
        </p>
      </article>
    </section>
  );
}
