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

vi.mock('@/lib/school-groups', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/school-groups')>();
  return {
    ...actual,
    schoolGroupsApi: {
      ...actual.schoolGroupsApi,
      list: vi.fn().mockResolvedValue([])
    }
  };
});

vi.mock('@/lib/enrollments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/enrollments')>();
  return {
    ...actual,
    enrollmentsApi: {
      ...actual.enrollmentsApi,
      list: vi.fn().mockResolvedValue([]),
      mine: vi.fn().mockResolvedValue([])
    }
  };
});

vi.mock('@/lib/placements', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/placements')>();
  return {
    ...actual,
    placementsApi: { ...actual.placementsApi, list: vi.fn().mockResolvedValue([]) }
  };
});

vi.mock('@/lib/students', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/students')>();
  return {
    ...actual,
    studentsApi: { ...actual.studentsApi, list: vi.fn().mockResolvedValue([]) }
  };
});

vi.mock('@/lib/coaches', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/coaches')>();
  return {
    ...actual,
    coachesApi: { ...actual.coachesApi, list: vi.fn().mockResolvedValue([]) }
  };
});

vi.mock('@/lib/terms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/terms')>();
  return {
    ...actual,
    termsApi: { ...actual.termsApi, list: vi.fn().mockResolvedValue([]) }
  };
});

vi.mock('@/lib/class-schedules', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/class-schedules')>();
  return {
    ...actual,
    classSchedulesApi: { ...actual.classSchedulesApi, list: vi.fn().mockResolvedValue([]) }
  };
});

vi.mock('@/lib/sessions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sessions')>();
  return {
    ...actual,
    sessionsApi: { ...actual.sessionsApi, list: vi.fn().mockResolvedValue([]) }
  };
});

vi.mock('@/lib/rate-cards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-cards')>();
  return {
    ...actual,
    rateCardsApi: { ...actual.rateCardsApi, list: vi.fn().mockResolvedValue([]) }
  };
});

vi.mock('@/lib/invoices', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/invoices')>();
  return {
    ...actual,
    invoicesApi: { ...actual.invoicesApi, list: vi.fn().mockResolvedValue([]) }
  };
});

vi.mock('@/lib/payouts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/payouts')>();
  return {
    ...actual,
    payoutsApi: { ...actual.payoutsApi, list: vi.fn().mockResolvedValue([]) }
  };
});

vi.mock('@/lib/courses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/courses')>();
  return {
    ...actual,
    coursesApi: { ...actual.coursesApi, list: vi.fn().mockResolvedValue([]) }
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

  it('renders the enrollments admin at /app/enrollments for a signed-in admin', async () => {
    seedSession('ADMIN');
    renderAt('/app/enrollments');
    expect(await screen.findByRole('button', { name: /new enrollment/i })).toBeInTheDocument();
  });

  it('renders the placement queue at /app/placements for a signed-in admin', async () => {
    seedSession('ADMIN');
    renderAt('/app/placements');
    expect(await screen.findByRole('button', { name: /schedule assessment/i })).toBeInTheDocument();
  });

  it('renders the partner schools admin at /app/school-groups for a signed-in admin', async () => {
    seedSession('ADMIN');
    renderAt('/app/school-groups');
    expect(await screen.findByRole('button', { name: /new school group/i })).toBeInTheDocument();
  });

  it('renders the coaches admin at /app/coaches for a signed-in admin', async () => {
    seedSession('ADMIN');
    renderAt('/app/coaches');
    expect(await screen.findByRole('button', { name: /new coach/i })).toBeInTheDocument();
  });

  it('renders the terms admin at /app/terms for a signed-in admin', async () => {
    seedSession('ADMIN');
    renderAt('/app/terms');
    expect(await screen.findByRole('button', { name: /new term/i })).toBeInTheDocument();
  });

  it('renders the class schedules admin at /app/class-schedules for a signed-in admin', async () => {
    seedSession('ADMIN');
    renderAt('/app/class-schedules');
    expect(await screen.findByRole('button', { name: /new schedule/i })).toBeInTheDocument();
  });

  it('renders the weekly schedule at /app/schedule for a signed-in admin', async () => {
    seedSession('ADMIN');
    renderAt('/app/schedule');
    expect(await screen.findByRole('button', { name: /this week/i })).toBeInTheDocument();
  });

  it('renders the rate cards admin at /app/rate-cards for a signed-in admin', async () => {
    seedSession('ADMIN');
    renderAt('/app/rate-cards');
    expect(await screen.findByRole('button', { name: /new rate card/i })).toBeInTheDocument();
  });

  it('renders the invoices admin at /app/invoices for a signed-in admin', async () => {
    seedSession('ADMIN');
    renderAt('/app/invoices');
    expect(await screen.findByRole('button', { name: /generate invoice/i })).toBeInTheDocument();
  });

  it('renders the payouts admin at /app/payouts for a signed-in admin', async () => {
    seedSession('ADMIN');
    renderAt('/app/payouts');
    expect(await screen.findByRole('button', { name: /generate run/i })).toBeInTheDocument();
  });

  it('renders the courses admin at /app/courses for a signed-in admin', async () => {
    seedSession('ADMIN');
    renderAt('/app/courses');
    expect(await screen.findByRole('button', { name: /new course/i })).toBeInTheDocument();
  });

  it('gives every signed-in role the play lobby at /app/play', async () => {
    seedSession('STUDENT');
    renderAt('/app/play');
    expect(await screen.findByRole('button', { name: /create game/i })).toBeInTheDocument();
  });
});
