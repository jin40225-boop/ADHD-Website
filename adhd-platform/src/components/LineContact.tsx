/**
 * 頁尾「加入官方 LINE」區塊（02_v2 定稿）。
 *
 * 四個公開頁共用：內嵌 QR（不外連圖床）＋加友按鈕＋信箱一鍵複製。
 * 加友按鈕與 QR 指向同一個 LINE_URL，不會有兩者不一致的情況。
 */
import { MessageCircle } from 'lucide-react';
import { CopyButton } from './CopyButton';
import { LINE_URL, LineQrCode } from './LineQrCode';

export const CONTACT_EMAIL = 'jin40225@gmail.com';

export function LineContact() {
  return (
    <div className="bg-[#F0FDF4] border-t border-line-green/20 py-16 mt-20" id="line-contact">
      <div className="max-w-3xl mx-auto px-4 flex flex-col items-center text-center gap-6">
        <h4 className="text-3xl font-black text-brown mb-2">加入官方 LINE・搶先收到通知</h4>
        <p className="text-brown/80 text-lg">
          主題公布、開放報名、活動提醒都會在 LINE 第一時間通知！<br />不錯過任何一場聚會。
        </p>
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 w-full">
          <div className="bg-white border-2 border-brown rounded-2xl p-3 shadow-warm">
            <LineQrCode />
            <p className="text-xs font-bold text-brown mt-1">掃我加 LINE</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <a
              className="btn-warm py-4 px-12 bg-line-green text-white hover:opacity-90 shadow-warm border-transparent text-xl"
              href={LINE_URL}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="w-6 h-6 mr-2" /> 立即加入官方 LINE
            </a>
            <p className="text-brown/70 text-sm">或直接來信詢問：</p>
            <div className="flex items-center gap-2 bg-white border-2 border-brown/20 rounded-full py-2 px-4">
              <span className="font-mono text-sm text-brown">{CONTACT_EMAIL}</span>
              <CopyButton
                value={CONTACT_EMAIL}
                label="複製信箱"
                className="text-[11px] bg-gray-200 hover:bg-gray-300 text-gray-600 py-1 px-2 rounded transition-colors flex items-center gap-1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
