import { api, downloadFile } from './api-client';

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'VOID';
export const INVOICE_STATUSES: InvoiceStatus[] = ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'VOID'];
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PARTIAL: 'Part-paid',
  PAID: 'Paid',
  VOID: 'Void'
};

export function invoiceStatusChip(
  s: InvoiceStatus
): { cls: 'paid' | 'overdue' | 'pending'; label: string } {
  if (s === 'PAID') return { cls: 'paid', label: 'Paid' };
  if (s === 'VOID') return { cls: 'overdue', label: 'Void' };
  if (s === 'PARTIAL') return { cls: 'pending', label: 'Part-paid' };
  return { cls: 'pending', label: INVOICE_STATUS_LABEL[s] };
}

export type PaymentMethod = 'MPESA' | 'CASH' | 'OTHER';
export const PAYMENT_METHODS: PaymentMethod[] = ['MPESA', 'CASH', 'OTHER'];

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitAmount: string;
  amount: string;
  rateCardId: string | null;
  sessionId: string | null;
}

export interface InvoicePaymentRow {
  id: string;
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  paidAt: string;
  notes: string | null;
}

export interface Invoice {
  id: string;
  number: string;
  enrollmentId: string | null;
  schoolGroupId: string | null;
  billToUserId: string | null;
  periodStart: string;
  periodEnd: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: string;
  total: string;
  amountPaid: string;
  issuedAt: string | null;
  dueAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: InvoiceLine[];
  payments?: InvoicePaymentRow[];
  enrollment?: {
    id: string;
    deliveryType: string;
    level: string | null;
    student: { id: string; firstName: string; lastName: string };
  } | null;
  schoolGroup?: { id: string; institutionName: string } | null;
  billTo?: { id: string; email: string } | null;
}

export const invoicesApi = {
  list: (filters: { status?: InvoiceStatus; enrollmentId?: string; schoolGroupId?: string } = {}) => {
    const p = new URLSearchParams();
    if (filters.status) p.set('status', filters.status);
    if (filters.enrollmentId) p.set('enrollmentId', filters.enrollmentId);
    if (filters.schoolGroupId) p.set('schoolGroupId', filters.schoolGroupId);
    const s = p.toString();
    return api.get<Invoice[]>(`/invoices${s ? `?${s}` : ''}`);
  },
  get: (id: string) => api.get<Invoice>(`/invoices/${id}`),
  generateForEnrollment: (body: {
    enrollmentId: string;
    periodStart: string;
    periodEnd: string;
    notes?: string;
  }) => api.post<Invoice>('/invoices/generate/enrollment', body),
  generateForSchoolGroup: (body: {
    schoolGroupId: string;
    periodStart: string;
    periodEnd: string;
    notes?: string;
  }) => api.post<Invoice>('/invoices/generate/school-group', body),
  issue: (id: string, body: { dueAt?: string } = {}) => api.post<Invoice>(`/invoices/${id}/issue`, body),
  update: (id: string, body: { dueAt?: string; notes?: string }) =>
    api.patch<Invoice>(`/invoices/${id}`, body),
  recordPayment: (
    id: string,
    body: { amount: number; method?: PaymentMethod; reference?: string; paidAt?: string; notes?: string }
  ) => api.post<Invoice>(`/invoices/${id}/payments`, body),
  voidInvoice: (id: string) => api.post<Invoice>(`/invoices/${id}/void`),
  remove: (id: string) => api.del<{ id: string }>(`/invoices/${id}`),
  exportCsv: (filters: { status?: InvoiceStatus; from?: string; to?: string } = {}) => {
    const p = new URLSearchParams();
    if (filters.status) p.set('status', filters.status);
    if (filters.from) p.set('from', filters.from);
    if (filters.to) p.set('to', filters.to);
    const s = p.toString();
    return downloadFile(`/invoices/export${s ? `?${s}` : ''}`, 'invoices.csv');
  }
};
