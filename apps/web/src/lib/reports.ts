import { api, downloadFile } from './api-client';

export interface ReportOverview {
  students: { total: number; byLevel: Record<string, number> };
  enrollments: { byStatus: Record<string, number>; byDelivery: Record<string, number> };
  coaches: { byEmployment: Record<string, number> };
  schedule: { activeSchedules: number; sessionsThisMonth: Record<string, number> };
  placements: { scheduled: number; overdueReviews: number };
  billing: {
    invoicesByStatus: Record<string, number>;
    outstanding: number;
    paymentsReceivedAllTime: number;
  };
  payouts: { latestRunTotal: number; unpaidApprovedTotal: number };
  leads: { byStatus: Record<string, number> };
}

export interface RevenueRow {
  month: string;
  invoiced: number;
  paid: number;
  outstanding: number;
}

export interface CoachActivityRow {
  coachId: string;
  name: string;
  sessions: number;
  studentsTaught: number;
  sessionRate: number;
  payoutDue: number;
}

export interface EnrollmentFunnel {
  leads: { total: number; byStatus: Record<string, number>; converted: number };
  placements: { scheduled: number; completed: number };
  enrollments: { total: number; active: number };
}

export const reportsApi = {
  overview: () => api.get<ReportOverview>('/reports/overview'),
  revenue: (from?: string, to?: string) => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    const s = p.toString();
    return api.get<RevenueRow[]>(`/reports/revenue${s ? `?${s}` : ''}`);
  },
  coachActivity: (from?: string, to?: string) => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    const s = p.toString();
    return api.get<CoachActivityRow[]>(`/reports/coach-activity${s ? `?${s}` : ''}`);
  },
  funnel: () => api.get<EnrollmentFunnel>('/reports/enrollment-funnel'),
  exportStudents: () => downloadFile('/reports/students.csv', 'students.csv'),
  exportEnrollments: () => downloadFile('/reports/enrollments.csv', 'enrollments.csv'),
  exportAttendance: (from?: string, to?: string) => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    const s = p.toString();
    return downloadFile(`/reports/attendance.csv${s ? `?${s}` : ''}`, 'attendance.csv');
  }
};

export function sumValues(rec: Record<string, number>): number {
  return Object.values(rec).reduce((s, n) => s + n, 0);
}
