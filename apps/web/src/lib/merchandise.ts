import { api } from './api-client';

export interface MerchandiseItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  sizeOptions: string | null;
  stockQuantity: number;
  imageUrl: string | null;
  isActive: boolean;
}

export interface MerchandiseItemInput {
  name: string;
  description?: string;
  price: number;
  sizeOptions?: string;
  stockQuantity: number;
  imageUrl?: string;
  isActive?: boolean;
}

export type OrderStatus = 'PENDING' | 'FULFILLED' | 'CANCELLED';
export const ORDER_STATUSES: OrderStatus[] = ['PENDING', 'FULFILLED', 'CANCELLED'];
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  FULFILLED: 'Fulfilled',
  CANCELLED: 'Cancelled'
};

export interface OrderItem {
  id: string;
  merchandiseItemId: string;
  quantity: number;
  size: string | null;
  unitPrice: string;
  merchandiseItem?: { name: string };
}

export interface Order {
  id: string;
  status: OrderStatus;
  totalAmount: string;
  createdAt: string;
  items: OrderItem[];
  parent?: { firstName: string | null; lastName: string | null };
}

export const merchandiseApi = {
  list: () => api.get<MerchandiseItem[]>('/merchandise'),
  create: (input: MerchandiseItemInput) => api.post<MerchandiseItem>('/merchandise', input),
  update: (id: string, patch: Partial<MerchandiseItemInput>) =>
    api.patch<MerchandiseItem>(`/merchandise/${id}`, patch)
};

export const ordersApi = {
  list: () => api.get<Order[]>('/orders'),
  get: (id: string) => api.get<Order>(`/orders/${id}`),
  updateStatus: (id: string, status: OrderStatus) =>
    api.patch<Order>(`/orders/${id}/status`, { status })
};

export function orderStatusChip(s: OrderStatus): { cls: 'paid' | 'overdue' | 'pending'; label: string } {
  if (s === 'FULFILLED') return { cls: 'paid', label: 'Fulfilled' };
  if (s === 'CANCELLED') return { cls: 'overdue', label: 'Cancelled' };
  return { cls: 'pending', label: 'Pending' };
}

export function orderCustomerName(o: Order): string {
  const full = [o.parent?.firstName, o.parent?.lastName].filter(Boolean).join(' ').trim();
  return full || 'A parent';
}

export function orderSummary(o: Order): string {
  return o.items
    .map((it) => `${it.quantity}× ${it.merchandiseItem?.name ?? it.merchandiseItemId}${it.size ? ` (${it.size})` : ''}`)
    .join(', ');
}
