import { api } from './api-client';

export type DeliveryType = 'HOME' | 'CENTER' | 'SCHOOL_GROUP';
export type ClientType = 'INDIVIDUAL' | 'INSTITUTION';
export type StudentLevel = 'NOVICE' | 'INTERMEDIATE' | 'ADVANCED';
export type EnrollmentStatus =
  | 'PENDING_PLACEMENT'
  | 'WAITLISTED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'WITHDRAWN';

export type EnrollmentEventType =
  | 'CREATED'
  | 'PLACED'
  | 'LEVEL_CHANGE'
  | 'COACH_CHANGE'
  | 'DELIVERY_CHANGE'
  | 'PAUSED'
  | 'RESUMED'
  | 'WITHDRAWN'
  | 'WAITLISTED';

export const DELIVERY_TYPES: DeliveryType[] = ['HOME', 'CENTER', 'SCHOOL_GROUP'];
export const STUDENT_LEVELS: StudentLevel[] = ['NOVICE', 'INTERMEDIATE', 'ADVANCED'];
export const ENROLLMENT_STATUSES: EnrollmentStatus[] = [
  'PENDING_PLACEMENT',
  'WAITLISTED',
  'ACTIVE',
  'PAUSED',
  'WITHDRAWN'
];

export const DELIVERY_LABEL: Record<DeliveryType, string> = {
  HOME: 'Home',
  CENTER: 'Centre',
  SCHOOL_GROUP: 'School group'
};

export const LEVEL_LABEL: Record<StudentLevel, string> = {
  NOVICE: 'Novice',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced'
};

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  PENDING_PLACEMENT: 'Awaiting placement',
  WAITLISTED: 'Waitlisted',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  WITHDRAWN: 'Withdrawn'
};

// Maps enrollment status onto the three chip colours tokens.css defines.
export function enrollmentStatusChip(
  s: EnrollmentStatus
): { cls: 'paid' | 'overdue' | 'pending'; label: string } {
  const label = ENROLLMENT_STATUS_LABEL[s];
  if (s === 'ACTIVE') return { cls: 'paid', label };
  if (s === 'WITHDRAWN') return { cls: 'overdue', label };
  return { cls: 'pending', label };
}

export interface EnrollmentEvent {
  id: string;
  type: EnrollmentEventType;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
  byUserId: string | null;
  at: string;
}

export interface EnrollmentStudentRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  deliveryType: DeliveryType;
  schoolGroupId: string | null;
  clientType: ClientType;
  level: StudentLevel | null;
  assignedCoachId: string | null;
  status: EnrollmentStatus;
  startDate: string;
  endDate: string | null;
  pausedFrom: string | null;
  pausedTo: string | null;
  waitlistNote: string | null;
  createdAt: string;
  updatedAt: string;
  student?: EnrollmentStudentRef;
  schoolGroup?: { id: string; institutionName: string } | null;
  assignedCoach?: { id: string } | null;
  events?: EnrollmentEvent[];
}

export interface CreateEnrollmentInput {
  studentId: string;
  deliveryType: DeliveryType;
  schoolGroupId?: string;
  level?: StudentLevel;
  assignedCoachId?: string;
  startDate?: string;
  waitlisted?: boolean;
  note?: string;
}

export interface EnrollmentFilters {
  status?: EnrollmentStatus;
  deliveryType?: DeliveryType;
  studentId?: string;
  schoolGroupId?: string;
}

function query(filters: EnrollmentFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.deliveryType) params.set('deliveryType', filters.deliveryType);
  if (filters.studentId) params.set('studentId', filters.studentId);
  if (filters.schoolGroupId) params.set('schoolGroupId', filters.schoolGroupId);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const enrollmentsApi = {
  list: (filters: EnrollmentFilters = {}) =>
    api.get<Enrollment[]>(`/enrollments${query(filters)}`),
  mine: () => api.get<Enrollment[]>('/enrollments/mine'),
  get: (id: string) => api.get<Enrollment>(`/enrollments/${id}`),
  create: (input: CreateEnrollmentInput) => api.post<Enrollment>('/enrollments', input),
  update: (
    id: string,
    patch: {
      deliveryType?: DeliveryType;
      schoolGroupId?: string;
      level?: StudentLevel;
      assignedCoachId?: string;
      note?: string;
    }
  ) => api.patch<Enrollment>(`/enrollments/${id}`, patch),
  place: (id: string, body: { level: StudentLevel; assignedCoachId?: string; note?: string }) =>
    api.post<Enrollment>(`/enrollments/${id}/place`, body),
  pause: (id: string, body: { pausedFrom?: string; pausedTo?: string; note?: string } = {}) =>
    api.post<Enrollment>(`/enrollments/${id}/pause`, body),
  resume: (id: string, body: { note?: string } = {}) =>
    api.post<Enrollment>(`/enrollments/${id}/resume`, body),
  withdraw: (id: string, body: { endDate?: string; note?: string } = {}) =>
    api.post<Enrollment>(`/enrollments/${id}/withdraw`, body),
  waitlist: (id: string, body: { note?: string } = {}) =>
    api.post<Enrollment>(`/enrollments/${id}/waitlist`, body),
  remove: (id: string) => api.del<{ id: string }>(`/enrollments/${id}`)
};

export function formatCrmDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
