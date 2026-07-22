/**
 * 路由表。【CLAUDE】
 * 2026-07-22：公開前台與 /admin/* 均已接 Supabase 真實資料流；公開 GPT
 * 查找則由獨立唯讀 MCP Function 提供，不在瀏覽器 bundle 中處理私密資料。
 * 後台採 lazy 分包，公開前台 bundle 不含後台程式碼。
 */
import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { RouterProvider, createBrowserRouter, useParams } from 'react-router-dom';
import { LoadingState } from '@/components/ui';
import PublicLayout from '@/routes/PublicLayout';
import Placeholder from '@/routes/Placeholder';
import RegisterPage from '@/routes/RegisterPage';
import AdminLayout from '@/admin/AdminLayout';
import AdminLogin from '@/admin/AdminLogin';
import RequireAuth from '@/admin/RequireAuth';

// 公開前台（ANTIGRAVITY 交付）
import HomePage from '@/pages/public/HomePage';
import PeerGroupPage from '@/pages/public/PeerGroupPage';
import NavigatorConsultPage from '@/pages/public/NavigatorConsultPage';
import ParentConsultPage from '@/pages/public/ParentConsultPage';
import RecommendationMapPage from '@/pages/public/RecommendationMapPage';
import SubmitRecommendationPage from '@/pages/public/SubmitRecommendationPage';
import NewbieGuidePage from '@/pages/public/NewbieGuidePage';
import ArticlesPage from '@/pages/public/ArticlesPage';
import ArticleDetailPage from '@/pages/public/ArticleDetailPage';
import InstructorsPage from '@/pages/public/InstructorsPage';
import FeedbackPage from '@/pages/public/FeedbackPage';

const InstructorAvailabilityPage = lazy(() => import('@/pages/InstructorAvailabilityPage'));
// 行政後台（CODEX 模組 × CLAUDE 整合層，lazy 分包）
const AdminOverview = lazy(() => import('@/admin/pages/AdminOverview'));
const RegistrationsPage = lazy(() => import('@/admin/pages/RegistrationsPage'));
const SessionsPage = lazy(() => import('@/admin/pages/SessionsPage'));
const InstructorSchedulingPage = lazy(() => import('@/admin/pages/InstructorSchedulingPage'));
const RecommendationsPage = lazy(() => import('@/admin/pages/RecommendationsPage'));
const TemplatesPage = lazy(() => import('@/admin/pages/TemplatesPage'));
const FormsPage = lazy(() => import('@/admin/pages/FormsPage'));
const CasesPage = lazy(() => import('@/admin/pages/CasesPage'));
const FeedbackAdminPage = lazy(() => import('@/admin/pages/FeedbackPage'));
const UiGallery = lazy(() =>
  import('@/components/ui/_gallery').then((module) => ({ default: module.UiGallery })),
);

function withSuspense(node: ReactNode) {
  return <Suspense fallback={<LoadingState label="載入模組…" />}>{node}</Suspense>;
}

/** /articles/:slug → ArticleDetailPage 的參數轉接。 */
function ArticleDetailRoute() {
  const { slug } = useParams();
  return <ArticleDetailPage slug={slug} />;
}

// GitHub Pages base path（'/ADHD-Website/'）→ react-router basename 去尾斜線。
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <PublicLayout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'peer-group', element: <PeerGroupPage /> },
        { path: 'peer-group/register', element: <RegisterPage slug="peer-group" /> },
        { path: 'navigator', element: <NavigatorConsultPage /> },
        { path: 'navigator/register', element: <RegisterPage slug="navigator" /> },
        { path: 'parent', element: <ParentConsultPage /> },
        { path: 'parent/register', element: <RegisterPage slug="parent" /> },
        { path: 'map', element: <RecommendationMapPage /> },
        { path: 'map/submit', element: <SubmitRecommendationPage /> },
        { path: 'guide', element: <NewbieGuidePage /> },
        { path: 'articles', element: <ArticlesPage /> },
        { path: 'articles/:slug', element: <ArticleDetailRoute /> },
        { path: 'instructors', element: <InstructorsPage /> },
        {
          path: 'instructor/availability',
          element: (
            <RequireAuth>{withSuspense(<InstructorAvailabilityPage />)}</RequireAuth>
          ),
        },
        { path: 'feedback', element: <FeedbackPage /> },
      ],
    },
    // 後台登入（不套 RequireAuth）
    { path: '/admin/login', element: <AdminLogin /> },
    // 後台殼
    {
      path: '/admin',
      element: (
        <RequireAuth>
          <AdminLayout />
        </RequireAuth>
      ),
      children: [
        { index: true, element: withSuspense(<AdminOverview />) },
        { path: 'registrations', element: withSuspense(<RegistrationsPage />) },
        { path: 'sessions', element: withSuspense(<SessionsPage />) },
        { path: 'instructors', element: withSuspense(<InstructorSchedulingPage />) },
        { path: 'recommendations', element: withSuspense(<RecommendationsPage />) },
        { path: 'templates', element: withSuspense(<TemplatesPage />) },
        { path: 'forms', element: withSuspense(<FormsPage />) },
        { path: 'cases', element: withSuspense(<CasesPage />) },
        { path: 'feedback', element: withSuspense(<FeedbackAdminPage />) },
        // 開發者工具：CODEX 品牌元件庫展示頁
        { path: 'gallery', element: withSuspense(<UiGallery />) },
      ],
    },
    // 404
    { path: '*', element: <Placeholder title="404 —— 找不到頁面" note="您要找的頁面不存在或已搬移。" /> },
  ],
  { basename },
);

export default function AppRouter() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
