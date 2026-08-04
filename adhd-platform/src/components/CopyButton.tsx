/**
 * 一鍵複製按鈕。
 *
 * 舊站的「複製」鈕是搬過來的靜態 HTML（id="copyButton" / id="copyMessage"），
 * 沒有任何 handler，點下去不會有反應。這裡改成真的寫入剪貼簿並回饋「已複製」。
 */
import { useState } from 'react';
import { Check, Copy, TriangleAlert } from 'lucide-react';

export interface CopyButtonProps {
  /** 要複製的文字（信箱、帳號等）。 */
  value: string;
  label?: string;
  className?: string;
}

export function CopyButton({ value, label = '複製', className = '' }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      // 瀏覽器拒絕存取剪貼簿時要講出來，不能靜默失敗讓按鈕看起來是壞的
      setState('failed');
    }
    setTimeout(() => setState('idle'), 1800);
  }

  const Icon = { idle: Copy, copied: Check, failed: TriangleAlert }[state];

  return (
    <button type="button" onClick={copy} title={value} className={className}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      {state === 'copied' ? '已複製' : state === 'failed' ? '請手動複製' : label}
    </button>
  );
}
