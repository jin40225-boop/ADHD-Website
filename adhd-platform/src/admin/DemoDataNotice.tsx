/**
 * 後台模組共用的示意資料提示。【CLAUDE 整合層】
 * 核心工程 K1（Supabase）／K2（Google Edge Functions）串接後，改為真實資料層並移除本提示。
 */
export default function DemoDataNotice({ note }: { note?: string }) {
  return (
    <div className="mb-4 rounded-xl border-2 border-brown/40 bg-accent-orange/25 px-4 py-2.5 text-sm">
      <strong>示意資料模式：</strong>
      目前顯示本地假資料，所有操作僅存於瀏覽器記憶體，重新整理即還原。
      {note ? <span>{note}</span> : null}
      　後端（Supabase／Edge Functions）串接後即為真實資料。
    </div>
  );
}
