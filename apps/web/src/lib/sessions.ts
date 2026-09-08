import { api } from './api-client';

export type SessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'LOGGED';
export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  LOGGED: 'Logged'
};

export function sessionStatusChip(
  s: SessionStatus
): { cls: 'paid' | 'overdue' | 'pending'; label: string } {
  if (s === 'COMPLETED' || s === 'LOGGED') return { cls: 'paid', label: SESSION_STATUS_LABEL[s] };
  if (s === 'CANCELLED') return { cls: 'overdue', label: 'Cancelled' };
  return { cls: 'pending', label: 'Scheduled' };
}

export interface SessionAttendanceRow {
  id?: string;
  studentId: string;
  present: boolean;
}

export interface SessionRecord {
  id: string;
  coachId: string;
  groupName: string | null;
  date: string;
  startsAt: string | null;
  endsAt: string | null;
  topic: string;
  notes: string | null;
  status: SessionStatus;
  classScheduleId: string | null;
  classSchedule?: {
    id: string;
    title: string;
    deliveryType: string;
    venue: string | null;
  } | null;
  coach?: { id: string; user?: { email: string } };
  attendance: SessionAttendanceRow[];
}

export interface SessionFilters {
  scope?: 'own';
  from?: string;
  to?: string;
  status?: SessionStatus;
}

function query(f: SessionFilters): string {
  const p = new URLSearchParams();
  if (f.scope) p.set('scope', f.scope);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.status) p.set('status', f.status);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const sessionsApi = {
  list: (filters: SessionFilters = {}) => api.get<SessionRecord[]>(`/sessions${query(filters)}`),
  get: (id: string) => api.get<SessionRecord>(`/sessions/${id}`),
  complete: (id: string, body: { topic?: string; notes?: string; presentStudentIds: string[] }) =>
    api.post<SessionRecord>(`/sessions/${id}/complete`, body),
  cancel: (id: string, body: { notes?: string } = {}) =>
    api.post<SessionRecord>(`/sessions/${id}/cancel`, body)
};

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
