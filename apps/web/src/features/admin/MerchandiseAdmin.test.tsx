import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MerchandiseAdmin } from './MerchandiseAdmin';
import type { MerchandiseItem, Order } from '@/lib/merchandise';

const createCalls: unknown[] = [];
const updateCalls: { id: string; patch: unknown }[] = [];
const statusCalls: { id: string; status: string }[] = [];
let listItemsImpl: () => Promise<MerchandiseItem[]>;
let listOrdersImpl: () => Promise<Order[]>;

vi.mock('@/lib/merchandise', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/merchandise')>();
  return {
    ...actual,
    merchandiseApi: {
      list: () => listItemsImpl(),
      create: (input: unknown) => {
        createCalls.push(input);
        return Promise.resolve({ id: 'mi-9' } as MerchandiseItem);
      },
      update: (id: string, patch: unknown) => {
        updateCalls.push({ id, patch });
        return Promise.resolve({ id } as MerchandiseItem);
      }
    },
    ordersApi: {
      list: () => listOrdersImpl(),
      get: vi.fn(),
      updateStatus: (id: string, status: string) => {
        statusCalls.push({ id, status });
        return Promise.resolve({ id, status } as unknown as Order);
      }
    }
  };
});

const item = (over: Partial<MerchandiseItem> = {}): MerchandiseItem => ({
  id: 'mi-1',
  name: 'Club T-Shirt',
  description: null,
  price: '1200.00',
  sizeOptions: 'S,M,L',
  stockQuantity: 10,
  imageUrl: null,
  isActive: true,
  ...over
});

const order = (over: Partial<Order> = {}): Order => ({
  id: 'o1',
  status: 'PENDING',
  totalAmount: '2400.00',
  createdAt: '2026-09-14T00:00:00Z',
  items: [{ id: 'oi1', merchandiseItemId: 'mi-1', quantity: 2, size: 'M', unitPrice: '1200.00', merchandiseItem: { name: 'Club T-Shirt' } }],
  parent: { firstName: 'Grace', lastName: 'Wambui' },
  ...over
});

function renderAdmin() {
  return render(
    <MemoryRouter>
      <MerchandiseAdmin />
    </MemoryRouter>
  );
}

beforeEach(() => {
  createCalls.length = 0;
  updateCalls.length = 0;
  statusCalls.length = 0;
  listItemsImpl = async () => [item()];
  listOrdersImpl = async () => [order()];
});

describe('MerchandiseAdmin', () => {
  it('lists the catalog on the Catalog tab by default', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Club T-Shirt')).toBeInTheDocument();
    expect(within(table).getByText('KES 1,200')).toBeInTheDocument();
  });

  it('creates a new catalog item', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'New item' }));
    await user.type(screen.getByLabelText('Name'), 'Club Hoodie');
    await user.clear(screen.getByLabelText(/Price/));
    await user.type(screen.getByLabelText(/Price/), '3500');
    await user.clear(screen.getByLabelText(/Stock quantity/));
    await user.type(screen.getByLabelText(/Stock quantity/), '5');
    await user.click(screen.getByRole('button', { name: 'Create item' }));

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({ name: 'Club Hoodie', price: 3500, stockQuantity: 5 });
  });

  it('edits an item, including toggling active', async () => {
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');
    const row = within(table).getByText('Club T-Shirt').closest('tr') as HTMLElement;

    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('checkbox', { name: /active/i }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateCalls[0]).toMatchObject({ id: 'mi-1', patch: { isActive: false } });
  });

  it('switches to the Orders tab and lists orders with a product/customer summary', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Orders' }));

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Grace Wambui')).toBeInTheDocument();
    expect(within(table).getByText(/2× Club T-Shirt \(M\)/)).toBeInTheDocument();
    expect(within(table).getByText('KES 2,400')).toBeInTheDocument();
  });

  it('fulfills a pending order', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Orders' }));
    await screen.findByText('Grace Wambui');

    await user.click(screen.getByRole('button', { name: 'Fulfill' }));

    expect(statusCalls).toContainEqual({ id: 'o1', status: 'FULFILLED' });
  });
});
