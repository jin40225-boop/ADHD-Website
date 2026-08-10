import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { RouterProvider, createBrowserRouter, useParams } from 'react-router-dom';
import { LoadingState } from '@/components/ui';
import { StaleChunkBoundary } from '@/components/StaleChunkBoundary';
import { clearStaleChunkFlag, watchForStaleChunks } from '@/lib/staleChunk';
import PublicLayout from '@/routes/PublicLayout';
import Placeholder from '@/routes/Placeholder';
import RegisterPage from '@/routes/RegisterPage';
import AdminShell from '@/admin/AdminShell';
import AdminLogin from '@/admin/AdminLogin';
import RequireAuth from '@/admin/RequireAuth';
import RequireAdmin from '@/admin/RequireAdmin';
import HomePage from '@/pages/public/HomePage';
import PeerGroupPage from '@/pages/public/PeerGroupPage';
import NavigatorConsultPage from '@/pages/public/NavigatorConsultPage';
import ParentConsultPage from '@/pages/public/ParentConsultPage';
import CareerConsultPage from '@/pages/public/CareerConsultPage';
import CoHostPage from '@/pages/public/CoHostPage';
import RecommendationMapPage from '@/pages/public/RecommendationMapPage';
import SubmitRecommendationPage from '@/pages/public/SubmitRecommendationPage';
import NewbieGuidePage from '@/pages/public/NewbieGuidePage';
import ArticlesPage from '@/pages/public/ArticlesPage';
import ArticleDetailPage from '@/pages/public/ArticleDetailPage';
import InstructorsPage from '@/pages/public/InstructorsPage';
import FeedbackPage from '@/pages/public/FeedbackPage';
import ConfirmResultPage from '@/pages/public/ConfirmResultPage';

const InstructorAvailabilityPage = lazy(() => import('@/pages/InstructorAvailabilityPage'));
const OperationsOverviewPage = lazy(() => import('@/admin/pages/OperationsOverviewPage'));
const TasksPage = lazy(() => import('@/admin/pages/TasksPage'));
const InboxPage = lazy(() => import('@/admin/pages/InboxPage'));
const PeoplePage = lazy(() => import('@/admin/pages/PeoplePage'));
const RegistrationsPage = lazy(() => import('@/admin/pages/RegistrationsOperationsPage'));
const CasesPage = lazy(() => import('@/admin/pages/CasesOperationsPage'));
const ActivitiesPage = lazy(() => import('@/admin/pages/ActivitiesPage'));
const SessionsPage = lazy(() => import('@/admin/pages/SessionsPage'));
const InstructorSchedulingPage = lazy(() => import('@/admin/pages/InstructorSchedulingPage'));
const RecommendationsPage = lazy(() => import('@/admin/pages/RecommendationsPage'));
const TemplatesPage = lazy(() => import('@/admin/pages/TemplatesPage'));
const FormsPage = lazy(() => import('@/admin/pages/FormsPage'));
const FeedbackAdminPage = lazy(() => import('@/admin/pages/FeedbackPage'));
const TeamPage = lazy(() => import('@/admin/pages/TeamPage'));
const IntegrationsPage = lazy(() => import('@/admin/pages/IntegrationsPage'));
const SettingsPage = lazy(() => import('@/admin/pages/SettingsPage'));
const DocumentsPage = lazy(() => import('@/admin/pages/DocumentsPage'));
const AuditPage = lazy(() => import('@/admin/pages/AuditPage'));
const UiGallery = lazy(() => import('@/components/ui/_gallery').then((module) => ({ default: module.UiGallery })));

// 每個 lazy 路由都包一層：chunk 過期是「載入的那一刻」才會炸，而後台整頁都是 lazy 的。
function withSuspense(node: ReactNode) {
  return <StaleChunkBoundary><Suspense fallback={<LoadingState label="載入頁面中…" />}>{node}</Suspense></StaleChunkBoundary>;
}
watchForStaleChunks();
function ArticleDetailRoute() { const { slug } = useParams(); return <ArticleDetailPage slug={slug} />; }
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

const router = createBrowserRouter([
  { path: '/', element: <PublicLayout />, children: [
    { index: true, element: <HomePage /> },
    { path: 'peer-group', element: <PeerGroupPage /> },
    { path: 'peer-group/register', element: <RegisterPage slug="peer-group" /> },
    { path: 'navigator', element: <NavigatorConsultPage /> },
    { path: 'navigator/register', element: <RegisterPage slug="navigator" showPastSessions /> },
    { path: 'parent', element: <ParentConsultPage /> },
    { path: 'parent/register', element: <RegisterPage slug="parent" /> },
    { path: 'career', element: <CareerConsultPage /> },
    { path: 'career/register', element: <RegisterPage slug="career" /> },
    // 協辦活動沒有 register 路由：報名一律在主辦單位的表單，本站不受理。
    { path: 'co-host', element: <CoHostPage /> },
    { path: 'map', element: <RecommendationMapPage /> },
    { path: 'map/submit', element: <SubmitRecommendationPage /> },
    { path: 'guide', element: <NewbieGuidePage /> },
    { path: 'articles', element: <ArticlesPage /> },
    { path: 'articles/:slug', element: <ArticleDetailRoute /> },
    { path: 'instructors', element: <InstructorsPage /> },
    { path: 'instructor/availability', element: <RequireAuth>{withSuspense(<InstructorAvailabilityPage />)}</RequireAuth> },
    { path: 'feedback', element: <FeedbackPage /> },
  ]},
  // 信裡的確認按鈕落地頁。獨立於 PublicLayout 之外：家長是從信件點進來看一句結果的，
  // 不需要先穿過整個站台導覽。confirm-attendance 做完資料庫動作後 302 導到這裡。
  { path: '/confirm-result', element: <ConfirmResultPage /> },
  { path: '/admin/login', element: <AdminLogin /> },
  { path: '/admin', element: <RequireAuth><RequireAdmin><AdminShell /></RequireAdmin></RequireAuth>, children: [
    { index: true, element: withSuspense(<OperationsOverviewPage />) },
    { path: 'tasks', element: withSuspense(<TasksPage />) },
    { path: 'inbox', element: withSuspense(<InboxPage />) },
    { path: 'people', element: withSuspense(<PeoplePage />) },
    { path: 'registrations', element: withSuspense(<RegistrationsPage />) },
    { path: 'cases', element: withSuspense(<CasesPage />) },
    { path: 'activities', element: withSuspense(<ActivitiesPage />) },
    { path: 'sessions', element: withSuspense(<SessionsPage />) },
    { path: 'instructors', element: withSuspense(<InstructorSchedulingPage />) },
    { path: 'recommendations', element: withSuspense(<RecommendationsPage />) },
    { path: 'templates', element: withSuspense(<TemplatesPage />) },
    { path: 'forms', element: withSuspense(<FormsPage />) },
    { path: 'feedback', element: withSuspense(<FeedbackAdminPage />) },
    { path: 'team', element: withSuspense(<TeamPage />) },
    { path: 'integrations', element: withSuspense(<IntegrationsPage />) },
    { path: 'settings', element: withSuspense(<SettingsPage />) },
    { path: 'documents', element: withSuspense(<DocumentsPage />) },
    { path: 'audit', element: withSuspense(<AuditPage />) },
    { path: 'gallery', element: withSuspense(<UiGallery />) },
  ]},
  { path: '*', element: <Placeholder title="404 找不到頁面" note="這個網址不存在，請從導覽列重新前往。" /> },
], { basename });

export default function AppRouter() {
  // 撐到這裡就代表這一版載入成功了，把「已自動重載過」的旗標清掉——下一次部署才有機會再救一次。
  useEffect(() => { clearStaleChunkFlag(); }, []);
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
