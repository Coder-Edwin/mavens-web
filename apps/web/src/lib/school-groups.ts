import { api } from './api-client';

export type SchoolGroupStatus = 'PROSPECT' | 'ACTIVE' | 'INACTIVE';
export const SCHOOL_GROUP_STATUSES: SchoolGroupStatus[] = ['PROSPECT', 'ACTIVE', 'INACTIVE'];

export const SCHOOL_GROUP_STATUS_LABEL: Record<SchoolGroupStatus, string> = {
  PROSPECT: 'Prospect',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive'
};

export interface SchoolGroup {
  id: string;
  institutionName: string;
  address: string | null;
  coordinatorName: string | null;
  coordinatorPhone: string | null;
  coordinatorEmail: string | null;
  agreedGroupSize: number | null;
  status: SchoolGroupStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { enrollments: number };
}

export interface SchoolGroupInput {
  institutionName: string;
  address?: string;
  coordinatorName?: string;
  coordinatorPhone?: string;
  coordinatorEmail?: string;
  agreedGroupSize?: number;
  status?: SchoolGroupStatus;
  notes?: string;
}

export const schoolGroupsApi = {
  list: (status?: SchoolGroupStatus) =>
    api.get<SchoolGroup[]>(`/school-groups${status ? `?status=${status}` : ''}`),
  get: (id: string) => api.get<SchoolGroup>(`/school-groups/${id}`),
  create: (input: SchoolGroupInput) => api.post<SchoolGroup>('/school-groups', input),
  update: (id: string, patch: Partial<SchoolGroupInput>) =>
    api.patch<SchoolGroup>(`/school-groups/${id}`, patch),
  remove: (id: string) => api.del<{ id: string }>(`/school-groups/${id}`)
};
