import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { Shell } from '@/layouts/Shell';
import { AdminOverview } from '@/features/admin/AdminOverview';
import { CoachDashboard } from '@/features/coach/CoachDashboard';
import { StudentDashboard } from '@/features/student/StudentDashboard';
import { ParentDashboard } from '@/features/parent/ParentDashboard';

function AuthenticatedApp() {
  const { user, logout } = useAuth();
  // Amwai's dual role: an ADMIN with isCoach=true can toggle into their own
  // coach view. Defaults to the admin view on login.
  const [viewAsCoach, setViewAsCoach] = useState(false);

  if (!user) return null; // only rendered once AppShell has confirmed a user exists

  const effectiveRole = user.role === 'ADMIN' && user.isCoach && viewAsCoach ? 'coach' : user.role.toLowerCase();

  return (
    <Shell
      user={user}
      viewAsCoach={viewAsCoach}
      onToggleCoachView={() => setViewAsCoach((v) => !v)}
      onLogout={logout}
    >
      {effectiveRole === 'admin' && <AdminOverview />}
      {effectiveRole === 'coach' && <CoachDashboard />}
      {effectiveRole === 'student' && <StudentDashboard />}
      {effectiveRole === 'parent' && <ParentDashboard />}
    </Shell>
  );
}

function AppShell() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null; // avoids a login-screen flash while localStorage is checked
  return user ? <AuthenticatedApp /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
