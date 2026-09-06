import { api } from './api-client';

export type LeadStatus = 'NEW' | 'CONTACTED' | 'ENROLLED' | 'ARCHIVED';

export interface Lead {
  id: string;
  parentName: string;
  email: string;
  phone: string;
  childName: string | null;
  childAge: number | null;
  message: string | null;
  status: LeadStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadInput {
  parentName: string;
  email: string;
  phone: string;
  childName?: string;
  childAge?: number;
  message?: string;
}

export const LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'ENROLLED', 'ARCHIVED'];

export const leadsApi = {
  submit: (input: LeadInput) => api.post<Lead>('/leads', input),
  list: (status?: LeadStatus) => api.get<Lead[]>(`/leads${status ? `?status=${status}` : ''}`),
  update: (id: string, patch: { status?: LeadStatus; notes?: string }) =>
    api.patch<Lead>(`/leads/${id}`, patch),
  remove: (id: string) => api.del<{ id: string }>(`/leads/${id}`)
};

export function formatLeadDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
