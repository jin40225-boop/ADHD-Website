/**
 * 後台模組共用的示意資料提示。
 * Supabase 早已串接：這個提示不是「功能還沒做」，而是「這次載入沒有讀到連線設定」。
 * 引用它的每一頁都只在退回 mock 的那條分支渲染它（!isSupabaseReady 或 NOT_READY），
 * 有連線時走的是真實資料、完全不會出現本提示——所以文案要講「為什麼這次是假的」，
 * 不能再宣稱後端尚未接上。
 */
export default function DemoDataNotice({ note }: { note?: string }) {
  return (
    <div className="mb-4 rounded-xl border-2 border-brown/40 bg-accent-orange/25 px-4 py-2.5 text-sm">
      <strong>示意資料模式：</strong>
      這次載入沒有讀到 Supabase 連線設定（VITE_SUPABASE_URL／VITE_SUPABASE_ANON_KEY），本頁已退回本地假資料；所有操作僅存於瀏覽器記憶體，重新整理即還原。
      {note ? <span>{note}</span> : null}
      　設定齊全時（正式站即是）本頁走的是 Supabase 真實資料，不會出現這則提示。
    </div>
  );
}
