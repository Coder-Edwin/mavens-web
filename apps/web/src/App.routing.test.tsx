import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth-context';
import { AppRoutes } from './App';

// The role dashboards fetch from the API on mount — stub them so routing
// tests stay isolated from the network.
vi.mock('@/features/admin/AdminOverview', () => ({
  AdminOverview: () => <div>ADMIN DASHBOARD</div>
}));
vi.mock('@/features/coach/CoachDashboard', () => ({
  CoachDashboard: () => <div>COACH DASHBOARD</div>
}));
vi.mock('@/features/student/StudentDashboard', () => ({
  StudentDashboard: () => <div>STUDENT DASHBOARD</div>
}));
vi.mock('@/features/parent/ParentDashboard', () => ({
  ParentDashboard: () => <div>PARENT DASHBOARD</div>
}));

function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>
  );
}

function seedSession(role: 'ADMIN' | 'COACH' | 'STUDENT' | 'PARENT') {
  localStorage.setItem('mavens_token', 'test-token');
  localStorage.setItem(
    'mavens_user',
    JSON.stringify({ id: 'u1', email: 'user@example.com', role, isCoach: role === 'ADMIN' })
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('AppRoutes', () => {
  it('shows the public landing page at /', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: /mavens chess club/i })).toBeInTheDocument();
  });

  it('shows the join placeholder at /join', async () => {
    renderAt('/join');
    expect(await screen.findByRole('heading', { name: /registration is opening soon/i })).toBeInTheDocument();
  });

  it('redirects an unauthenticated visit to /app back to the login screen', async () => {
    renderAt('/app');
    expect(await screen.findByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.queryByText('ADMIN DASHBOARD')).not.toBeInTheDocument();
  });

  it('renders the role dashboard at /app when a session exists', async () => {
    seedSession('PARENT');
    renderAt('/app');
    expect(await screen.findByText('PARENT DASHBOARD')).toBeInTheDocument();
  });

  it('bounces an authenticated user away from /login to /app', async () => {
    seedSession('ADMIN');
    renderAt('/login');
    expect(await screen.findByText('ADMIN DASHBOARD')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  it('sends unknown routes back to the landing page', async () => {
    renderAt('/nope/not/a/route');
    expect(await screen.findByRole('heading', { level: 1, name: /mavens chess club/i })).toBeInTheDocument();
  });
});
