import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { LandingPage } from '@/pages/LandingPage';
import { JoinPage } from '@/pages/JoinPage';
import { ArticlesPage } from '@/pages/ArticlesPage';
import { ArticlePage } from '@/pages/ArticlePage';
import { Shell } from '@/layouts/Shell';
import { AdminOverview } from '@/features/admin/AdminOverview';
import { ArticlesAdmin } from '@/features/admin/ArticlesAdmin';
import { LeadsAdmin } from '@/features/admin/LeadsAdmin';
import { CoachDashboard } from '@/features/coach/CoachDashboard';
import { StudentDashboard } from '@/features/student/StudentDashboard';
import { ParentDashboard } from '@/features/parent/ParentDashboard';

function AuthenticatedApp() {
  const { user, logout } = useAuth();
  // Amwai's dual role: an ADMIN with isCoach=true can toggle into their own
  // coach view. Defaults to the admin view on login.
  const [viewAsCoach, setViewAsCoach] = useState(false);

  if (!user) return null; // route guard already ensures this, kept for type-narrowing

  const effectiveRole =
    user.role === 'ADMIN' && user.isCoach && viewAsCoach ? 'coach' : user.role.toLowerCase();

  return (
    <Shell
      user={user}
      viewAsCoach={viewAsCoach}
      onToggleCoachView={() => setViewAsCoach((v) => !v)}
      onLogout={logout}
    >
      {effectiveRole === 'admin' && (
        <Routes>
          <Route index element={<AdminOverview />} />
          <Route path="articles" element={<ArticlesAdmin />} />
          <Route path="leads" element={<LeadsAdmin />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      )}
      {effectiveRole === 'coach' && <CoachDashboard />}
      {effectiveRole === 'student' && <StudentDashboard />}
      {effectiveRole === 'parent' && <ParentDashboard />}
    </Shell>
  );
}

/**
 * Route tree, split out from <App> so tests can mount it inside a
 * MemoryRouter. Public marketing routes ('/', '/join', '/articles') are
 * always reachable; '/app' requires a session, '/login' bounces to '/app'
 * once you have one.
 */
export function AppRoutes() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null; // avoids a redirect flash while localStorage is checked

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/articles" element={<ArticlesPage />} />
      <Route path="/articles/:slug" element={<ArticlePage />} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <LoginScreen />} />
      <Route
        path="/app/*"
        element={user ? <AuthenticatedApp /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
