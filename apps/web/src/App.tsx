import { useState, type ReactElement } from 'react';
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
import { AnnouncementsAdmin } from '@/features/admin/AnnouncementsAdmin';
import { SchoolGroupsAdmin } from '@/features/admin/SchoolGroupsAdmin';
import { EnrollmentsAdmin } from '@/features/admin/EnrollmentsAdmin';
import { PlacementsAdmin } from '@/features/admin/PlacementsAdmin';
import { CoachesAdmin } from '@/features/admin/CoachesAdmin';
import { TermsAdmin } from '@/features/admin/TermsAdmin';
import { ClassSchedulesAdmin } from '@/features/admin/ClassSchedulesAdmin';
import { SchedulePage } from '@/features/admin/SchedulePage';
import { RateCardsAdmin } from '@/features/admin/RateCardsAdmin';
import { InvoicesAdmin } from '@/features/admin/InvoicesAdmin';
import { PayoutsAdmin } from '@/features/admin/PayoutsAdmin';
import { CoursesAdmin } from '@/features/admin/CoursesAdmin';
import { CourseEditor } from '@/features/admin/CourseEditor';
import { MyCoursesPage } from '@/features/student/MyCoursesPage';
import { CoursePlayerPage } from '@/features/student/CoursePlayerPage';
import { TournamentsAdmin } from '@/features/admin/TournamentsAdmin';
import { TournamentDetail } from '@/features/admin/TournamentDetail';
import { ReportsPage } from '@/features/admin/ReportsPage';
import { CoachDashboard } from '@/features/coach/CoachDashboard';
import { StudentDashboard } from '@/features/student/StudentDashboard';
import { ParentDashboard } from '@/features/parent/ParentDashboard';
import { PlayLobby } from '@/features/play/PlayLobby';
import { GamePage } from '@/features/play/GamePage';
import { AnalysisBoard } from '@/features/play/AnalysisBoard';

const DASHBOARDS: Record<string, ReactElement> = {
  admin: <AdminOverview />,
  coach: <CoachDashboard />,
  student: <StudentDashboard />,
  parent: <ParentDashboard />
};

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
      <Routes>
        <Route index element={DASHBOARDS[effectiveRole] ?? DASHBOARDS.student} />
        <Route path="play" element={<PlayLobby />} />
        <Route path="play/:id" element={<GamePage />} />
        <Route path="analysis" element={<AnalysisBoard />} />
        <Route path="learn" element={<MyCoursesPage />} />
        <Route path="learn/:courseId" element={<CoursePlayerPage />} />
        {effectiveRole === 'admin' && (
          <>
            <Route path="articles" element={<ArticlesAdmin />} />
            <Route path="leads" element={<LeadsAdmin />} />
            <Route path="announcements" element={<AnnouncementsAdmin />} />
            <Route path="school-groups" element={<SchoolGroupsAdmin />} />
            <Route path="enrollments" element={<EnrollmentsAdmin />} />
            <Route path="placements" element={<PlacementsAdmin />} />
            <Route path="coaches" element={<CoachesAdmin />} />
            <Route path="terms" element={<TermsAdmin />} />
            <Route path="class-schedules" element={<ClassSchedulesAdmin />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="rate-cards" element={<RateCardsAdmin />} />
            <Route path="invoices" element={<InvoicesAdmin />} />
            <Route path="payouts" element={<PayoutsAdmin />} />
            <Route path="courses" element={<CoursesAdmin />} />
            <Route path="courses/:id" element={<CourseEditor />} />
            <Route path="tournaments" element={<TournamentsAdmin />} />
            <Route path="tournaments/:id" element={<TournamentDetail />} />
            <Route path="reports" element={<ReportsPage />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
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
