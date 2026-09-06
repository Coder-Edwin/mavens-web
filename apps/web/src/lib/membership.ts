import { api } from './api-client';

export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED';

export interface Membership {
  id: string;
  studentId: string;
  status: MembershipStatus;
  periodStart: string;
  periodEnd: string;
  plan: { name: string; amount: string };
}

export const membershipApi = {
  /** Current membership for a student, or null if they've never had one. */
  forStudent: (studentId: string) => api.get<Membership | null>(`/payments/membership/${studentId}`),
  /** Start the yearly membership M-Pesa payment. */
  pay: (studentId: string, phoneNumber: string) =>
    api.post<{ paymentId: string; status: string; message: string }>(
      '/payments/mpesa/membership-stk-push',
      { studentId, phoneNumber }
    )
};

/** True when the membership covers today. */
export function isMembershipCurrent(m: Membership | null): boolean {
  return !!m && m.status === 'ACTIVE' && new Date(m.periodEnd).getTime() > Date.now();
}

export function formatMembershipDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
