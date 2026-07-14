import { Link } from 'react-router-dom';
import KnowledgeMeetupContent from '../../content/articles/01-knowledge-meetup';
import RecommendationDbContent from '../../content/articles/02-recommendation-db';
import CommunitiesContent from '../../content/articles/03-communities';
import OrganizationsContent from '../../content/articles/04-organizations';
import TermsContent from '../../content/articles/05-terms';

interface Props {
  slug?: string;
}

// slug 以 src/data/articles-index.json 為準；同時相容內容檔名的編號版 slug。
const ARTICLE_CONTENT: Record<string, () => JSX.Element> = {
  'knowledge-meetup': () => <KnowledgeMeetupContent />,
  'recommendation-db': () => <RecommendationDbContent />,
  'communities': () => <CommunitiesContent />,
  'organizations': () => <OrganizationsContent />,
  'terms': () => <TermsContent />,
  '01-knowledge-meetup': () => <KnowledgeMeetupContent />,
  '02-recommendation-db': () => <RecommendationDbContent />,
  '03-communities': () => <CommunitiesContent />,
  '04-organizations': () => <OrganizationsContent />,
  '05-terms': () => <TermsContent />,
};

export default function ArticleDetailPage({ slug = 'knowledge-meetup' }: Props) {
  const renderContent = ARTICLE_CONTENT[slug];

  return (
    <div className="min-h-screen bg-cream text-brown py-12 px-4 md:px-8">
      <div className="max-w-4xl mx-auto bg-white border-2 border-brown rounded-3xl p-6 md:p-10 shadow-warm-lg">
        <Link
          to="/articles"
          className="inline-block text-sm font-bold text-highlight hover:underline mb-6"
        >
          ← 返回專欄列表
        </Link>
        {renderContent ? (
          renderContent()
        ) : (
          <div className="py-12 text-center space-y-3">
            <h1 className="text-2xl font-extrabold">找不到這篇文章</h1>
            <p className="text-sm text-brown/80">文章可能已搬移或網址有誤，請回到專欄列表查看。</p>
          </div>
        )}
      </div>
    </div>
  );
}
