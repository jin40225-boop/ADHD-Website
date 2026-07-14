/**
 * 通用「施工中」占位頁。【CLAUDE 骨架】
 * ANTIGRAVITY 的 pages/public 或 CODEX 的 features 交付後，於 router.tsx 換掉對應 import。
 */
import { Link } from 'react-router-dom';

interface PlaceholderProps {
  title: string;
  note?: string;
  /** 負責交付的角色，方便追蹤。 */
  owner?: 'CODEX' | 'ANTIGRAVITY' | 'CLAUDE';
}

export default function Placeholder({ title, note, owner }: PlaceholderProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="warm-card warm-card--hoverable p-10">
        <h1 className="mb-3 text-2xl font-bold">{title}</h1>
        <p className="text-brown/70">{note ?? '此頁面骨架已就緒，內容建置中。'}</p>
        {owner && (
          <p className="mt-4 inline-block rounded-full border-2 border-brown bg-base-yellow px-3 py-1 text-sm">
            待交付：{owner}
          </p>
        )}
        <div className="mt-8">
          <Link to="/" className="btn-warm">回首頁</Link>
        </div>
      </div>
    </div>
  );
}
