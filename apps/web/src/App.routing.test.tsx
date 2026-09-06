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

// Public + admin pages that fetch articles on mount — keep the network out.
vi.mock('@/lib/articles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/articles')>();
  return {
    ...actual,
    articlesApi: {
      ...actual.articlesApi,
      listPublic: vi.fn().mockResolvedValue([]),
      getBySlug: vi.fn().mockResolvedValue({
        id: '1', slug: 'x', title: 'X', excerpt: 'x', body: 'x', coverImageUrl: null, publishedAt: null
      }),
      listAdmin: vi.fn().mockResolvedValue([])
    }
  };
});

vi.mock('@/lib/leads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/leads')>();
  return {
    ...actual,
    leadsApi: { ...actual.leadsApi, list: vi.fn().mockResolvedValue([]), submit: vi.fn() }
  };
});

vi.mock('@/lib/announcements', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/announcements')>();
  return {
    ...actual,
    announcementsApi: {
      ...actual.announcementsApi,
      feed: vi.fn().mockResolvedValue([]),
      listAdmin: vi.fn().mockResolvedValue([])
    }
  };
});

vi.mock('@/lib/games', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/games')>();
  return {
    ...actual,
    gamesApi: {
      list: vi.fn().mockResolvedValue({ open: [], mine: [] }),
      get: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      join: vi.fn(),
      cancel: vi.fn()
    },
    connectGameSocket: () => ({
      move: vi.fn(),
      resign: vi.fn(),
      cancel: vi.fn(),
      rejoin: vi.fn(),
      disconnect: vi.fn()
    })
  };
});

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

  it('shows the join / interest form at /join', async () => {
    renderAt('/join');
    expect(await screen.findByRole('heading', { name: /register your interest/i })).toBeInTheDocument();
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

  it('serves the public articles index at /articles', async () => {
    renderAt('/articles');
    expect(await screen.findByRole('heading', { name: /articles & news/i })).toBeInTheDocument();
  });

  it('serves a public article at /articles/:slug', async () => {
    renderAt('/articles/x');
    expect(await screen.findByRole('heading', { level: 1, name: 'X' })).toBeInTheDocument();
  });

  it('renders the admin article manager at /app/articles for a signed-in admin', async () => {
    seedSession('ADMIN');
    renderAt('/app/articles');
    expect(await screen.findByRole('button', { name: /new article/i })).toBeInTheDocument();
    expect(screen.getByText('All articles')).toBeInTheDocument();
  });

  it('renders the admin leads inbox at /app/leads for a signed-in admin', async () => {
    seedSession('ADMIN');
    renderAt('/app/leads');
    expect(await screen.findByText('Enquiries')).toBeInTheDocument();
  });

  it('renders the admin announcements manager at /app/announcements for a signed-in admin', async () => {
    seedSession('ADMIN');
    renderAt('/app/announcements');
    expect(await screen.findByRole('button', { name: /send announcement/i })).toBeInTheDocument();
  });

  it('gives every signed-in role the play lobby at /app/play', async () => {
    seedSession('STUDENT');
    renderAt('/app/play');
    expect(await screen.findByRole('button', { name: /create game/i })).toBeInTheDocument();
  });
});
