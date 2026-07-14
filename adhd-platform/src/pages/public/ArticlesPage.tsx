import { BookOpen, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import articlesIndex from '../../data/articles-index.json';

interface ArticleMeta {
  slug: string;
  title: string;
  category: string;
  order: number;
}

export default function ArticlesPage() {
  const articles = articlesIndex as ArticleMeta[];

  return (
    <div className="min-h-screen bg-[#FFFDF5] text-[#5D4037] py-12 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="bg-[#FFEC8B] border-2 border-[#5D4037] rounded-3xl p-8 shadow-[4px_4px_0px_0px_#5D4037]">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-[#D84315]" />
            ADHD 自立與知識專欄
          </h1>
          <p className="mt-2 text-sm md:text-base">
            紀載我們逐步因應症狀、規劃生活、建立習慣的探索歷程。傳承經驗，少走彎路。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.map(art => (
            <Link
              key={art.slug}
              to={`/articles/${art.slug}`}
              className="bg-white border-2 border-[#5D4037] rounded-2xl p-6 shadow-[4px_4px_0px_0px_#5D4037] hover:translate-y-[-3px] transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className="inline-block bg-[#80CBC4]/30 border border-[#5D4037] text-xs font-bold px-2.5 py-0.5 rounded-md">
                  {art.category || '專欄心得'}
                </span>
                <h3 className="text-xl font-extrabold">{art.title}</h3>
                <p className="text-sm text-[#5D4037]/80 leading-relaxed">
                  {'點擊閱讀完整圖文與經驗探索...'}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#5D4037]/10 flex items-center justify-between text-sm font-bold text-[#D84315]">
                <span>閱讀全文</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
