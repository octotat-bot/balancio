import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { useAuthStore } from './stores/authStore';
import AuthPage from './pages/auth/AuthPage';
import Dashboard from './pages/dashboard/Dashboard';
import GroupList from './pages/groups/GroupList';
import GroupDetail from './pages/groups/GroupDetail';
import CreateGroup from './pages/groups/CreateGroup';
import Settlements from './pages/settlements/Settlements';
import Friends from './pages/friends/Friends';
import FriendDetail from './pages/friends/FriendDetail';
import Onboarding from './pages/onboarding/Onboarding';
import Notifications from './pages/notifications/Notifications';
import Profile from './pages/profile/Profile';
import Analytics from './pages/analytics/Analytics';
import Layout from './components/Layout';
import SettlementNotifications from './components/notifications/SettlementNotifications';
import FirstTimeExperience from './components/first-time/FirstTimeExperience';

function DashboardWithTour() {
  return (
    <>
      <Dashboard />
      <FirstTimeExperience />
    </>
  );
}

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

// Public Route wrapper (redirects to dashboard if already authenticated)
function PublicRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const wantsNewSession = params.get('switch') === '1' || params.get('signup') === '1';

  if (isAuthenticated && !wantsNewSession) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  const { initAuth, _hasHydrated } = useAuthStore();

  useEffect(() => {
    initAuth();

    // Safety fallback: If hydration doesn't happen within 1s, force it
    // This prevents the app from being stuck on the loading screen
    const timer = setTimeout(() => {
      if (!_hasHydrated) {
        useAuthStore.setState({ _hasHydrated: true });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [initAuth, _hasHydrated]);

  // Wait for Zustand to hydrate from localStorage before rendering routes
  if (!_hasHydrated) {
    return (
      <div className="app-splash">
        <div className="app-splash-spinner" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/auth"
            element={
              <PublicRoute>
                <AuthPage />
              </PublicRoute>
            }
          />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardWithTour />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="groups" element={<GroupList />} />
            <Route path="groups/new" element={<CreateGroup />} />
            <Route path="groups/:groupId" element={<GroupDetail />} />
            <Route path="friends" element={<Friends />} />
            <Route path="friends/:friendshipId" element={<FriendDetail />} />
            <Route path="settlements" element={<Settlements />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        {/* Global Settlement Notifications - appears on all pages */}
        <SettlementNotifications />
      </Router>
    </ToastProvider>
  );
}

export default App;
