import { api } from './api-client';

export type TermStatus = 'PLANNED' | 'ACTIVE' | 'CLOSED';
export const TERM_STATUSES: TermStatus[] = ['PLANNED', 'ACTIVE', 'CLOSED'];
export const TERM_STATUS_LABEL: Record<TermStatus, string> = {
  PLANNED: 'Planned',
  ACTIVE: 'Active',
  CLOSED: 'Closed'
};

export function termStatusChip(s: TermStatus): { cls: 'paid' | 'overdue' | 'pending'; label: string } {
  if (s === 'ACTIVE') return { cls: 'paid', label: 'Active' };
  if (s === 'CLOSED') return { cls: 'overdue', label: 'Closed' };
  return { cls: 'pending', label: 'Planned' };
}

export interface Term {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: TermStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { schedules: number };
}

export interface TermInput {
  name: string;
  startDate: string;
  endDate: string;
  status?: TermStatus;
  notes?: string;
}

export const termsApi = {
  list: (status?: TermStatus) => api.get<Term[]>(`/terms${status ? `?status=${status}` : ''}`),
  get: (id: string) => api.get<Term>(`/terms/${id}`),
  create: (input: TermInput) => api.post<Term>('/terms', input),
  update: (id: string, patch: Partial<TermInput>) => api.patch<Term>(`/terms/${id}`, patch),
  remove: (id: string) => api.del<{ id: string }>(`/terms/${id}`)
};
