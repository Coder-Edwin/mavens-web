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

export type ConvertDeliveryType = 'HOME' | 'CENTER' | 'SCHOOL_GROUP';
export type ConvertLevel = 'NOVICE' | 'INTERMEDIATE' | 'ADVANCED';

export interface ConvertLeadInput {
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  dateOfBirth?: string;
  homeAddress?: string;
  level?: ConvertLevel;
  linkParent?: boolean;
  createEnrollment?: boolean;
  deliveryType?: ConvertDeliveryType;
  schoolGroupId?: string;
  assignedCoachId?: string;
  schedulePlacement?: boolean;
  placementScheduledFor?: string;
}

export interface ConvertLeadResult {
  student: { id: string; firstName: string; lastName: string };
  studentTempPassword: string;
  parentTempPassword: string | null;
  enrollment: { id: string } | null;
  placement: { id: string } | null;
}

export const leadsApi = {
  submit: (input: LeadInput) => api.post<Lead>('/leads', input),
  list: (status?: LeadStatus) => api.get<Lead[]>(`/leads${status ? `?status=${status}` : ''}`),
  update: (id: string, patch: { status?: LeadStatus; notes?: string }) =>
    api.patch<Lead>(`/leads/${id}`, patch),
  convert: (id: string, input: ConvertLeadInput) =>
    api.post<ConvertLeadResult>(`/leads/${id}/convert`, input),
  remove: (id: string) => api.del<{ id: string }>(`/leads/${id}`)
};

export function formatLeadDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
