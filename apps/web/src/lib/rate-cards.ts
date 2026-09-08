import { api } from './api-client';
import type { DeliveryType, StudentLevel, ClientType } from './enrollments';

export type RateUnit = 'PER_SESSION' | 'PER_MONTH' | 'PER_TERM';
export const RATE_UNITS: RateUnit[] = ['PER_SESSION', 'PER_MONTH', 'PER_TERM'];
export const RATE_UNIT_LABEL: Record<RateUnit, string> = {
  PER_SESSION: 'Per session',
  PER_MONTH: 'Per month',
  PER_TERM: 'Per term'
};

export interface RateCard {
  id: string;
  name: string;
  deliveryType: DeliveryType;
  level: StudentLevel | null;
  clientType: ClientType | null;
  unit: RateUnit;
  amount: string;
  currency: string;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RateCardInput {
  name: string;
  deliveryType: DeliveryType;
  level?: StudentLevel | null;
  clientType?: ClientType | null;
  unit?: RateUnit;
  amount: number;
  currency?: string;
  active?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  notes?: string;
}

export const rateCardsApi = {
  list: (filters: { deliveryType?: DeliveryType; active?: boolean } = {}) => {
    const p = new URLSearchParams();
    if (filters.deliveryType) p.set('deliveryType', filters.deliveryType);
    if (filters.active !== undefined) p.set('active', String(filters.active));
    const s = p.toString();
    return api.get<RateCard[]>(`/rate-cards${s ? `?${s}` : ''}`);
  },
  get: (id: string) => api.get<RateCard>(`/rate-cards/${id}`),
  create: (input: RateCardInput) => api.post<RateCard>('/rate-cards', input),
  update: (id: string, patch: Partial<RateCardInput>) => api.patch<RateCard>(`/rate-cards/${id}`, patch),
  remove: (id: string) => api.del<{ id: string }>(`/rate-cards/${id}`)
};

export function formatKes(amount: string | number, currency = 'KES'): string {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
