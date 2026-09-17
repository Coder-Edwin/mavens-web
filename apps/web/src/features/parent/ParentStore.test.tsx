import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParentStore } from './ParentStore';

const postCalls: { path: string; body: unknown }[] = [];
let getImpl: () => Promise<unknown>;

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: () => getImpl(),
      post: (path: string, body: unknown) => {
        postCalls.push({ path, body });
        return Promise.resolve({});
      }
    }
  };
});

const item = (over: Record<string, unknown> = {}) => ({
  id: 'mi-1',
  name: 'Club T-Shirt',
  price: '1200.00',
  sizeOptions: 'S,M,L',
  stockQuantity: 10,
  ...over
});

beforeEach(() => {
  postCalls.length = 0;
  getImpl = async () => [item()];
});

describe('ParentStore', () => {
  it('gives the Store nav item a real page listing merchandise', async () => {
    render(<ParentStore />);
    expect(await screen.findByText('Club T-Shirt')).toBeInTheDocument();
  });

  it('buys an item, with no child selection needed', async () => {
    const user = userEvent.setup();
    render(<ParentStore />);
    await screen.findByText('Club T-Shirt');

    await user.click(screen.getByRole('button', { name: 'Buy' }));

    expect(postCalls).toEqual([{ path: '/orders', body: { items: [{ merchandiseItemId: 'mi-1', quantity: 1 }] } }]);
    expect(await screen.findByText('Order placed!')).toBeInTheDocument();
  });

  it('disables buying an item that is out of stock', async () => {
    getImpl = async () => [item({ stockQuantity: 0 })];
    render(<ParentStore />);
    expect(await screen.findByRole('button', { name: 'Out of stock' })).toBeDisabled();
  });
});
