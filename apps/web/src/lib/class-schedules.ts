import { api } from './api-client';
import type { DeliveryType, StudentLevel } from './enrollments';

export type ScheduleStatus = 'ACTIVE' | 'PAUSED' | 'ENDED';
export const SCHEDULE_STATUSES: ScheduleStatus[] = ['ACTIVE', 'PAUSED', 'ENDED'];
export const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  ENDED: 'Ended'
};

export function scheduleStatusChip(
  s: ScheduleStatus
): { cls: 'paid' | 'overdue' | 'pending'; label: string } {
  if (s === 'ACTIVE') return { cls: 'paid', label: 'Active' };
  if (s === 'ENDED') return { cls: 'overdue', label: 'Ended' };
  return { cls: 'pending', label: 'Paused' };
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface ClassSchedule {
  id: string;
  title: string;
  deliveryType: DeliveryType;
  schoolGroupId: string | null;
  level: StudentLevel | null;
  coachId: string | null;
  venue: string | null;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  termId: string | null;
  startDate: string;
  endDate: string | null;
  status: ScheduleStatus;
  capacity: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  term?: { id: string; name: string; startDate: string; endDate: string } | null;
  coach?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    user?: { email: string };
  } | null;
  schoolGroup?: { id: string; institutionName: string } | null;
  _count?: { sessions: number };
}

export interface ClassScheduleInput {
  title: string;
  deliveryType: DeliveryType;
  schoolGroupId?: string;
  level?: StudentLevel;
  coachId?: string;
  venue?: string;
  weekday: number;
  startTime: string;
  durationMinutes?: number;
  termId?: string;
  startDate: string;
  endDate?: string;
  status?: ScheduleStatus;
  capacity?: number;
  notes?: string;
}

export interface GenerateResult {
  created: number;
  skipped: number;
  from: string;
  to: string;
}

export interface ScheduleFilters {
  status?: ScheduleStatus;
  coachId?: string;
  termId?: string;
  deliveryType?: DeliveryType;
}

function query(f: ScheduleFilters): string {
  const p = new URLSearchParams();
  if (f.status) p.set('status', f.status);
  if (f.coachId) p.set('coachId', f.coachId);
  if (f.termId) p.set('termId', f.termId);
  if (f.deliveryType) p.set('deliveryType', f.deliveryType);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const classSchedulesApi = {
  list: (filters: ScheduleFilters = {}) =>
    api.get<ClassSchedule[]>(`/class-schedules${query(filters)}`),
  get: (id: string) => api.get<ClassSchedule>(`/class-schedules/${id}`),
  create: (input: ClassScheduleInput) => api.post<ClassSchedule>('/class-schedules', input),
  update: (id: string, patch: Partial<ClassScheduleInput>) =>
    api.patch<ClassSchedule>(`/class-schedules/${id}`, patch),
  generate: (id: string, body: { from?: string; to?: string } = {}) =>
    api.post<GenerateResult>(`/class-schedules/${id}/generate`, body),
  remove: (id: string) => api.del<{ id: string }>(`/class-schedules/${id}`)
};

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${period}`;
}
