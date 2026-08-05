import { useEffect, useRef, useState } from 'react';
import { clearGmailQueue, getGmailSyncState, triggerGmailSync } from '../operations/api';
import { syncGmailUntilDone, syncSummary } from '../operations/gmailSync';
import type { GmailSyncState } from '../operations/types';
import { WarmButton } from '@/components/ui/WarmButton/WarmButton';
import { MetricCard, OpsNotice, PageHeader, StatusPill } from '../operations/components';

export default function IntegrationsPage() {
  const [gmail, setGmail] = useState<GmailSyncState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [confirmingClear, setConfirmingClear] = useState(false);
  // 離開頁面就讓迴圈停在這一批。不停的話，使用者切走之後它仍在背景一批批打，
  // 稽核上看起來就像「頁面自己在同步」——那正是這次被誤判的其中一項。
  const left = useRef(false);
  useEffect(() => () => { left.current = true; }, []);
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
  /**
   * 清空佇列。仍然要確認一次，但確認做在頁面裡而不是 window.confirm——
   * 原生對話框在自動化瀏覽器裡會被自動取消，等於把所有代驗擋在門外，
   * 而「破壞性動作只能由人親手點」與「這個動作驗不到」是兩回事。
   */
  const clearQueue = async () => {
    setConfirmingClear(false);
    setBusy(true); setError(undefined);
    try {
      const result = await clearGmailQueue();
      setNotice(`已清空同步佇列（${result.cleared} 筆待處理編號）。已收進來的信件與信件串完全沒有變動，這個動作已寫入稽核。`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '清空佇列失敗');
    } finally { setBusy(false); }
  };
  const sync = async (full: boolean) => {
    setBusy(true);
    setError(undefined);
    try {
      /* 一次呼叫＝一批（每批最多 5 封），這裡把批次接連叫完。迴圈本身在 operations/gmailSync，
       * 因為收件匣也有一顆同步鈕——那顆先前只送一次請求，於是「按一次只前進 5 封」。 */
      const outcome = await syncGmailUntilDone(full, (progress) => {
        setNotice(`Gmail 同步中…第 ${progress.rounds} 批，已收進 ${progress.synced} 封、範圍外略過 ${progress.skipped} 封${progress.remaining ? `，還有 ${progress.remaining} 封排隊中` : ''}。`);
        void reload();
      }, () => left.current);
      await reload();
      const summary = syncSummary(outcome);
      if (outcome.stopped) setError(`${summary}（第 ${outcome.rounds + 1} 批中止：${outcome.stopped}。已完成的部分都已存檔，再按一次會從剩下的接著做。）`);
      else setNotice(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gmail 同步失敗');
    } finally {
      setBusy(false);
    }
  };  return (
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
          {/* 收信範圍改了之後，佇列裡的舊候選就不該收了。那是同步狀態、不是信件內容。 */}
          {confirmingClear
            ? <>
              <WarmButton disabled={busy} onClick={() => void clearQueue()}>確認清空佇列</WarmButton>
              <WarmButton variant="secondary" disabled={busy} onClick={() => setConfirmingClear(false)}>取消</WarmButton>
            </>
            : <WarmButton variant="secondary" disabled={busy} onClick={() => setConfirmingClear(true)}>清空同步佇列</WarmButton>}
        </div>
        {confirmingClear ? <OpsNotice tone="warning">
          佇列裡是「已排隊、還沒抓內容」的信件編號，清掉<b>不會刪除任何已收的信件</b>。
          之後若需要某個人的歷史往來，到人員主檔按「匯入這個人的歷史往來」即可。這個動作會寫入稽核。
        </OpsNotice> : null}
        <p className="ops-cell-muted">
          「先量體」只跑一次搜尋回報數量，不取信件內容、不寫入任何資料，隨時可按。
        </p>
      </article>
    </section>
  );
}
