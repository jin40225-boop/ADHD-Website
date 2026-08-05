/**
 * 「按一次就同步完」的那段迴圈，兩個入口共用。
 *
 * 為什麼要抽出來：同步鈕有兩顆——收件匣一顆、整合設定一顆。分批上線時我只把迴圈加在整合設定，
 * 收件匣那顆仍然是「送一次請求就結束」，於是每按一次只前進 5 封，佇列 113 封要按 23 次。
 * 兩顆按鈕做同一件事卻走兩套程式，那就是遲早會分岔——所以現在只有一套。
 */
import { triggerGmailSync } from './api';

/** 一次「按下同步」最多連續跑幾批。上限只是為了不在對方信箱異常時無限打下去。 */
export const MAX_BATCHES = 40;

export interface SyncProgress { rounds: number; synced: number; skipped: number; remaining: number }
export interface SyncOutcome extends SyncProgress { stopped?: string }

/**
 * 一直叫下一批，直到佇列清空、達到批次上限，或呼叫端要求停止。
 *
 * @param onProgress 每批結束時回報，讓畫面看得到「第幾批」——先前「只跑一批」與「跑了 40 批」
 *                   在畫面上長得一模一樣，是這個 bug 拖這麼久才被指認出來的原因之一。
 * @param shouldStop 呼叫端可要求中止（例如離開頁面）。沒有它的話，使用者切走之後迴圈仍在背景
 *                   繼續打，稽核上看起來就像「頁面自己在同步」。
 */
export async function syncGmailUntilDone(
  full: boolean,
  onProgress?: (progress: SyncProgress) => void,
  shouldStop?: () => boolean,
): Promise<SyncOutcome> {
  let synced = 0; let skipped = 0; let rounds = 0; let remaining = 0; let stopped: string | undefined;
  do {
    if (shouldStop?.()) { stopped = '已離開頁面，停在這一批'; break; }
    try {
      const result = await triggerGmailSync(rounds === 0 ? full : false);
      synced += result.synced ?? 0; skipped += result.skipped ?? 0; remaining = result.remaining ?? 0;
    } catch (error) {
      // 某一批失敗不該把前面幾批的成果一起吞掉：停下來，把做到哪裡與為什麼停一起回報。
      stopped = error instanceof Error ? error.message : '同步失敗';
      break;
    }
    rounds += 1;
    onProgress?.({ rounds, synced, skipped, remaining });
  } while (remaining > 0 && rounds < MAX_BATCHES);
  return { rounds, synced, skipped, remaining, stopped };
}

/** 兩個入口共用的結果文字。略過幾封要講出來——那是「收信範圍過濾有沒有在動」的唯一外顯訊號。 */
export function syncSummary(outcome: SyncOutcome) {
  return [
    `Gmail 同步：跑了 ${outcome.rounds} 批，收進 ${outcome.synced} 封`,
    outcome.skipped ? `，範圍外略過 ${outcome.skipped} 封（未讀取內容）` : '',
    outcome.remaining ? `。還有 ${outcome.remaining} 封排隊中——再按一次會接著處理` : '。',
  ].join('');
}
