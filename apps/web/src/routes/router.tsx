import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { RouteErrorPage } from '@/pages/error/route-error-page';
import { ROUTES } from './paths';

/**
 * Route table.
 *
 * Pages are lazy so the initial bundle carries only the shell and dashboard;
 * the chat transcript in particular will pull in heavy streaming and markdown
 * dependencies that should not block first paint.
 */
const DashboardPage = lazy(() => import('@/pages/dashboard/dashboard-page'));
const ChatPage = lazy(() => import('@/pages/chat/chat-page'));
const VoicePage = lazy(() => import('@/pages/voice/voice-page'));
const SettingsPage = lazy(() => import('@/pages/settings/settings-page'));
const NotFoundPage = lazy(() => import('@/pages/error/not-found-page'));

export const router = createBrowserRouter([
  {
    path: ROUTES.root,
    element: <AppShell />,
    // A thrown render error anywhere in the shell is caught here rather than
    // blanking the whole document, so navigation stays usable after a failure.
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to={ROUTES.dashboard} replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'chat/:conversationId', element: <ChatPage /> },
      { path: 'voice', element: <VoicePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/:section', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
