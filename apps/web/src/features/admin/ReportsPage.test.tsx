import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ReportsPage } from './ReportsPage';
import type { CoachActivityRow, EnrollmentFunnel, ReportOverview, RevenueRow } from '@/lib/reports';

const exportStudents = vi.fn();

vi.mock('@/lib/reports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/reports')>();
  return {
    ...actual,
    reportsApi: {
      overview: async (): Promise<ReportOverview> => ({
        students: { total: 20, byLevel: { NOVICE: 8, INTERMEDIATE: 5, UNPLACED: 7 } },
        enrollments: { byStatus: { ACTIVE: 12, WAITLISTED: 2 }, byDelivery: { CENTER: 10, HOME: 4 } },
        coaches: { byEmployment: { STAFF: 3 } },
        schedule: { activeSchedules: 4, sessionsThisMonth: { COMPLETED: 30, SCHEDULED: 6 } },
        placements: { scheduled: 2, overdueReviews: 3 },
        billing: { invoicesByStatus: { SENT: 5 }, outstanding: 12500, paymentsReceivedAllTime: 60000 },
        payouts: { latestRunTotal: 8100, unpaidApprovedTotal: 5000 },
        leads: { byStatus: { NEW: 4, ENROLLED: 6 } }
      }),
      revenue: async (): Promise<RevenueRow[]> => [
        { month: '2026-06', invoiced: 6000, paid: 5000, outstanding: 1000 }
      ],
      coachActivity: async (): Promise<CoachActivityRow[]> => [
        { coachId: 'c1', name: 'Brian O', sessions: 8, studentsTaught: 5, sessionRate: 900, payoutDue: 7200 }
      ],
      funnel: async (): Promise<EnrollmentFunnel> => ({
        leads: { total: 10, byStatus: { NEW: 4, ENROLLED: 6 }, converted: 6 },
        placements: { scheduled: 2, completed: 7 },
        enrollments: { total: 9, active: 6 }
      }),
      exportStudents: () => {
        exportStudents();
        return Promise.resolve();
      },
      exportEnrollments: vi.fn(),
      exportAttendance: vi.fn()
    }
  };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ReportsPage />
    </MemoryRouter>
  );
}

beforeEach(() => exportStudents.mockClear());

describe('ReportsPage', () => {
  it('shows headline KPIs and the coach-activity + revenue tables', async () => {
    renderPage();
    expect(await screen.findByText('KES 12,500')).toBeInTheDocument(); // outstanding
    expect(screen.getByText('Brian O')).toBeInTheDocument();
    expect(screen.getByText('2026-06')).toBeInTheDocument();
    expect(screen.getByText(/6 converted/)).toBeInTheDocument();
  });

  it('triggers a CSV download', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Brian O');
    await user.click(screen.getByRole('button', { name: /students csv/i }));
    expect(exportStudents).toHaveBeenCalled();
  });
});
