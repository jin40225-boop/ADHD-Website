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
    <div className="min-h-screen bg-cream text-brown py-12 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="bg-base-yellow border-2 border-brown rounded-3xl p-8 shadow-warm">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-highlight" />
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
              className="bg-white border-2 border-brown rounded-2xl p-6 shadow-warm hover:translate-y-[-3px] transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className="inline-block bg-teal/30 border border-brown text-xs font-bold px-2.5 py-0.5 rounded-md">
                  {art.category || '專欄心得'}
                </span>
                <h3 className="text-xl font-extrabold">{art.title}</h3>
                <p className="text-sm text-brown/80 leading-relaxed">
                  {'點擊閱讀完整圖文與經驗探索...'}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-brown/10 flex items-center justify-between text-sm font-bold text-highlight">
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
