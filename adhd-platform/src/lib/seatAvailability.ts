/**
 * 「這一場現在收不收得到報名」——**前台唯一的判斷來源**。
 *
 * 【為什麼要有這支】
 * 2026-08-28 的檢驗抓到：職場諮詢的按鈕寫著「目前時段已滿・仍可送出候補申請」，
 * 點進報名頁卻是「目前場次皆已額滿」、連表單都不給。
 * 原因是同一個決策被寫了兩次——`RegisterCta` 看了 `allowWaitlist`，
 * 而 `RegisterPage` 的 `optionsForSession` 只寫 `status !== 'open' || remaining === 0`。
 * 兩半用不同的表示法，遲早會分岔；這次是候補功能上線後當天就分岔了。
 *
 * 【這支必須和資料庫那道守門說同一件事】
 * 對應 `enforce_session_capacity`（`20260827000044_allow_applications_when_full.sql`）：
 *
 *   申請制 on_confirm：
 *     status 必須是 'open' 或 'full'；
 *     status='full' 時還要 allow_waitlist 為真才收。
 *     **完全不看名額**——申請制不扣名額，capacity/booked_count 在那裡沒有意義。
 *
 *   先到先得 on_submit：
 *     update ... where status='open' and booked_count < capacity
 *     也就是 status 必須是 'open'，而且還有剩。
 *     **刻意不支援候補**：名額旗標是每筆報名一個，表達不了「A 場佔位、B 場候補」。
 *
 * 改這裡就要同步改那支 migration，反之亦然。`check-admin-operations` 會擋下只改一邊。
 */
import type { SessionSlot } from '@contracts/types';

export type SeatPolicy = 'on_submit' | 'on_confirm';

export interface SeatAvailability {
  /** 現在送出去，資料庫會不會收。 */
  accepted: boolean;
  /** 收得到，但這一筆是候補（不佔名額）。文案要說實話，不能只寫「立即報名」。 */
  viaWaitlist: boolean;
}

export function seatAvailability(
  session: Pick<SessionSlot, 'status' | 'capacity' | 'bookedCount' | 'allowWaitlist'>,
  seatPolicy: SeatPolicy | undefined,
): SeatAvailability {
  // 未提供時視同 on_submit——與 DB 的欄位預設值一致，也是比較保守的那一邊。
  if ((seatPolicy ?? 'on_submit') === 'on_confirm') {
    if (session.status === 'open') return { accepted: true, viaWaitlist: false };
    if (session.status === 'full' && session.allowWaitlist === true) {
      return { accepted: true, viaWaitlist: true };
    }
    return { accepted: false, viaWaitlist: false };
  }

  const remaining = Math.max(0, session.capacity - session.bookedCount);
  return { accepted: session.status === 'open' && remaining > 0, viaWaitlist: false };
}

/** 只想知道「收不收」時用這個，語意比 `.accepted` 直白。 */
export function canRegister(
  session: Pick<SessionSlot, 'status' | 'capacity' | 'bookedCount' | 'allowWaitlist'>,
  seatPolicy: SeatPolicy | undefined,
): boolean {
  return seatAvailability(session, seatPolicy).accepted;
}
