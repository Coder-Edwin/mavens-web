import { api, downloadFile } from './api-client';

export type PayoutStatus = 'DRAFT' | 'APPROVED' | 'PAID';
export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  PAID: 'Paid'
};

export function payoutStatusChip(
  s: PayoutStatus
): { cls: 'paid' | 'overdue' | 'pending'; label: string } {
  if (s === 'PAID') return { cls: 'paid', label: 'Paid' };
  if (s === 'APPROVED') return { cls: 'pending', label: 'Approved' };
  return { cls: 'pending', label: 'Draft' };
}

export interface PayoutItem {
  id: string;
  coachId: string;
  sessionCount: number;
  ratePerSession: string;
  amount: string;
  notes: string | null;
  coach?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    user?: { email: string };
  };
}

export interface PayoutRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: PayoutStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items?: PayoutItem[];
  _count?: { items: number };
}

export const payoutsApi = {
  list: (status?: PayoutStatus) =>
    api.get<PayoutRun[]>(`/payouts${status ? `?status=${status}` : ''}`),
  get: (id: string) => api.get<PayoutRun>(`/payouts/${id}`),
  generate: (body: { periodStart: string; periodEnd: string; notes?: string }) =>
    api.post<PayoutRun>('/payouts/generate', body),
  approve: (id: string) => api.post<PayoutRun>(`/payouts/${id}/approve`),
  markPaid: (id: string) => api.post<PayoutRun>(`/payouts/${id}/mark-paid`),
  remove: (id: string) => api.del<{ id: string }>(`/payouts/${id}`),
  exportCsv: (id: string) => downloadFile(`/payouts/${id}/export`, 'payout-run.csv')
};
