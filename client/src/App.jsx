import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import Layout from './components/Layout';
import SettlementNotifications from './components/notifications/SettlementNotifications';

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

  if (isAuthenticated) {
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
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e5e5e5',
          borderTopColor: '#000',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
            <Route path="dashboard" element={<Dashboard />} />
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
