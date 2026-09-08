import { api } from './api-client';
import type { StudentLevel } from './enrollments';

export type PlacementStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export const PLACEMENT_STATUSES: PlacementStatus[] = ['SCHEDULED', 'COMPLETED', 'CANCELLED'];

export const PLACEMENT_STATUS_LABEL: Record<PlacementStatus, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

export function placementStatusChip(
  s: PlacementStatus
): { cls: 'paid' | 'overdue' | 'pending'; label: string } {
  if (s === 'COMPLETED') return { cls: 'paid', label: 'Completed' };
  if (s === 'CANCELLED') return { cls: 'overdue', label: 'Cancelled' };
  return { cls: 'pending', label: 'Scheduled' };
}

export interface PlacementAssessment {
  id: string;
  studentId: string;
  enrollmentId: string | null;
  scheduledFor: string | null;
  assessorCoachId: string | null;
  status: PlacementStatus;
  resultLevel: StudentLevel | null;
  notes: string | null;
  completedAt: string | null;
  nextReviewDue: string | null;
  createdAt: string;
  updatedAt: string;
  student?: { id: string; firstName: string; lastName: string; level: StudentLevel | null };
  assessorCoach?: { id: string } | null;
  enrollment?: {
    id: string;
    status: string;
    deliveryType: string;
    level: StudentLevel | null;
  } | null;
}

export interface SchedulePlacementInput {
  studentId: string;
  enrollmentId?: string;
  scheduledFor?: string;
  assessorCoachId?: string;
  notes?: string;
}

export interface PlacementFilters {
  status?: PlacementStatus;
  studentId?: string;
  dueBefore?: string;
}

function query(filters: PlacementFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.studentId) params.set('studentId', filters.studentId);
  if (filters.dueBefore) params.set('dueBefore', filters.dueBefore);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const placementsApi = {
  list: (filters: PlacementFilters = {}) =>
    api.get<PlacementAssessment[]>(`/placements${query(filters)}`),
  get: (id: string) => api.get<PlacementAssessment>(`/placements/${id}`),
  schedule: (input: SchedulePlacementInput) =>
    api.post<PlacementAssessment>('/placements', input),
  update: (
    id: string,
    patch: { scheduledFor?: string; assessorCoachId?: string; notes?: string }
  ) => api.patch<PlacementAssessment>(`/placements/${id}`, patch),
  complete: (
    id: string,
    body: { resultLevel: StudentLevel; nextReviewDue?: string; notes?: string }
  ) => api.post<PlacementAssessment>(`/placements/${id}/complete`, body),
  cancel: (id: string, body: { notes?: string } = {}) =>
    api.post<PlacementAssessment>(`/placements/${id}/cancel`, body),
  remove: (id: string) => api.del<{ id: string }>(`/placements/${id}`)
};
