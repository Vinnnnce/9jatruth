import { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { getMeAsync } from '@store/slices/authSlice';
import { setDarkMode } from '@store/slices/uiSlice';
import { ThemeProvider } from '@mui/material/styles';
import { getTheme } from '@theme/theme';
import ProtectedRoute from '@components/ProtectedRoute';
import Layout from '@components/Layout';
import LoadingSpinner from '@components/LoadingSpinner';

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('@pages/LoginPage'));
const DashboardPage = lazy(() => import('@pages/DashboardPage'));
const StatesPage = lazy(() => import('@pages/geo/StatesPage'));
const LgasPage = lazy(() => import('@pages/geo/LgasPage'));
const WardsPage = lazy(() => import('@pages/geo/WardsPage'));
const CommunitiesPage = lazy(() => import('@pages/geo/CommunitiesPage'));
const PartiesPage = lazy(() => import('@pages/politics/PartiesPage'));
const CandidatesPage = lazy(() => import('@pages/politics/CandidatesPage'));
const OfficesPage = lazy(() => import('@pages/politics/OfficesPage'));
const ElectionsPage = lazy(() => import('@pages/politics/ElectionsPage'));
const PostsReviewPage = lazy(() => import('@pages/moderation/PostsReviewPage'));
const CommentsReviewPage = lazy(() => import('@pages/moderation/CommentsReviewPage'));
const FactCheckPage = lazy(() => import('@pages/moderation/FactCheckPage'));
const ReportsPage = lazy(() => import('@pages/moderation/ReportsPage'));
const NewsPage = lazy(() => import('@pages/news/NewsPage'));
const UsersPage = lazy(() => import('@pages/users/UsersPage'));
const SettingsPage = lazy(() => import('@pages/settings/SettingsPage'));

export default function App() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, token } = useAppSelector((state) => state.auth);
  const { darkMode } = useAppSelector((state) => state.ui);

  // Initialize dark mode from stored preference
  useEffect(() => {
    const stored = localStorage.getItem('darkMode') === 'true';
    dispatch(setDarkMode(stored));
  }, [dispatch]);

  // Check auth on mount if token exists
  useEffect(() => {
    if (token && isAuthenticated) {
      dispatch(getMeAsync());
    }
  }, [token, isAuthenticated, dispatch]);

  return (
    <ThemeProvider theme={getTheme(darkMode ? 'dark' : 'light')}>
      <Suspense fallback={<LoadingSpinner fullHeight />}>
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

          {/* Protected routes with layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />

            {/* Geography */}
            <Route path="geo/states" element={<StatesPage />} />
            <Route path="geo/lgas" element={<LgasPage />} />
            <Route path="geo/wards" element={<WardsPage />} />
            <Route path="geo/communities" element={<CommunitiesPage />} />

            {/* Politics */}
            <Route path="politics/parties" element={<PartiesPage />} />
            <Route path="politics/candidates" element={<CandidatesPage />} />
            <Route path="politics/offices" element={<OfficesPage />} />
            <Route path="politics/elections" element={<ElectionsPage />} />

            {/* Moderation */}
            <Route path="moderation/posts" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MODERATOR']}><PostsReviewPage /></ProtectedRoute>} />
            <Route path="moderation/comments" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MODERATOR']}><CommentsReviewPage /></ProtectedRoute>} />
            <Route path="moderation/fact-checks" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'ANALYST']}><FactCheckPage /></ProtectedRoute>} />
            <Route path="moderation/reports" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MODERATOR']}><ReportsPage /></ProtectedRoute>} />

            {/* News */}
            <Route path="news" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'EDITOR']}><NewsPage /></ProtectedRoute>} />

            {/* Users */}
            <Route path="users" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}><UsersPage /></ProtectedRoute>} />

            {/* Settings */}
            <Route path="settings" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SettingsPage /></ProtectedRoute>} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </Suspense>
    </ThemeProvider>
  );
}
