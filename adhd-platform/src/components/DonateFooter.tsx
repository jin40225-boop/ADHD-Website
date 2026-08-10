/**
 * 頁尾贊助區塊。內容逐字取自四個既有公開頁（HomePage／PeerGroupPage／
 * ParentConsultPage／NavigatorConsultPage，四份完全相同）。
 *
 * 與 AboutFounder 同理：本次只讓新頁面用它，既有四頁不動，避免新增第 5、6 份拷貝，
 * 同時把改動範圍限制在新板塊內。
 */
import { Mail } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';

export function DonateFooter() {
  return (
    <div className="bg-gray-100 border-t border-gray-200 py-6" id="donate">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <h4 className="text-sm font-bold text-gray-500 mb-1">支持我的行動</h4>
        <p className="text-[10px] text-gray-400 mb-3 leading-tight">
          服務均為無償進行。若認同理念，歡迎小額贊助維持營運。<br />
          (不論是否打賞，都歡迎來信打氣！)
        </p>
        <div className="inline-block text-left text-xs">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <span>005 土地銀行</span>
            <span className="font-mono">016-212-34037-9</span>
            <CopyButton value="016-212-34037-9" className="text-[10px] bg-gray-200 hover:bg-gray-300 text-gray-600 py-1 px-2 rounded transition-colors flex items-center gap-1" />
          </div>
        </div>
        <div className="flex justify-center gap-4 mt-4 text-[10px] text-gray-400">
          <a className="hover:text-gray-500 flex items-center gap-1" href="mailto:jin40225@gmail.com">
            <Mail className="w-3 h-3" /> Email
          </a>
          <span>© 2026 大A彥宇</span>
        </div>
      </div>
    </div>
  );
}
