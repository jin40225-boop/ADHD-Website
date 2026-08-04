import { Suspense, lazy, type ReactNode } from 'react';
import { RouterProvider, createBrowserRouter, useParams } from 'react-router-dom';
import { LoadingState } from '@/components/ui';
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
import RecommendationMapPage from '@/pages/public/RecommendationMapPage';
import SubmitRecommendationPage from '@/pages/public/SubmitRecommendationPage';
import NewbieGuidePage from '@/pages/public/NewbieGuidePage';
import ArticlesPage from '@/pages/public/ArticlesPage';
import ArticleDetailPage from '@/pages/public/ArticleDetailPage';
import InstructorsPage from '@/pages/public/InstructorsPage';
import FeedbackPage from '@/pages/public/FeedbackPage';

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

function withSuspense(node: ReactNode) { return <Suspense fallback={<LoadingState label="載入頁面中…" />}>{node}</Suspense>; }
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
    { path: 'map', element: <RecommendationMapPage /> },
    { path: 'map/submit', element: <SubmitRecommendationPage /> },
    { path: 'guide', element: <NewbieGuidePage /> },
    { path: 'articles', element: <ArticlesPage /> },
    { path: 'articles/:slug', element: <ArticleDetailRoute /> },
    { path: 'instructors', element: <InstructorsPage /> },
    { path: 'instructor/availability', element: <RequireAuth>{withSuspense(<InstructorAvailabilityPage />)}</RequireAuth> },
    { path: 'feedback', element: <FeedbackPage /> },
  ]},
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

export default function AppRouter() { return <RouterProvider router={router} future={{ v7_startTransition: true }} />; }
