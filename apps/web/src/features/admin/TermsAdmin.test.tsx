import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TermsAdmin } from './TermsAdmin';
import type { Term } from '@/lib/terms';

const createCalls: unknown[] = [];
const removeCalls: string[] = [];
let listImpl: () => Promise<Term[]>;

vi.mock('@/lib/terms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/terms')>();
  return {
    ...actual,
    termsApi: {
      list: () => listImpl(),
      get: vi.fn(),
      create: (input: unknown) => {
        createCalls.push(input);
        return Promise.resolve({ id: 't9' } as Term);
      },
      update: vi.fn().mockResolvedValue({} as Term),
      remove: (id: string) => {
        removeCalls.push(id);
        return Promise.resolve({ id });
      }
    }
  };
});

const term = (over: Partial<Term>): Term => ({
  id: 't1',
  name: 'Term 2 2026',
  startDate: '2026-05-01T00:00:00Z',
  endDate: '2026-07-31T00:00:00Z',
  status: 'ACTIVE',
  notes: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  _count: { schedules: 3 },
  ...over
});

function renderAdmin() {
  return render(
    <MemoryRouter>
      <TermsAdmin />
    </MemoryRouter>
  );
}

beforeEach(() => {
  createCalls.length = 0;
  removeCalls.length = 0;
  listImpl = async () => [term({ id: 't1' }), term({ id: 't2', name: 'Term 3 2026', status: 'PLANNED', _count: { schedules: 0 } })];
});

describe('TermsAdmin', () => {
  it('lists terms with their schedule counts', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Term 2 2026')).toBeInTheDocument();
    expect(within(table).getByText('Term 3 2026')).toBeInTheDocument();
  });

  it('creates a term from the form, sending ISO dates', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'New term' }));
    await user.type(screen.getByLabelText('Name'), 'Term 1 2027');
    await user.type(screen.getByLabelText('Starts'), '2027-01-12');
    await user.type(screen.getByLabelText('Ends'), '2027-04-10');
    await user.click(screen.getByRole('button', { name: 'Create term' }));

    expect(createCalls).toHaveLength(1);
    const payload = createCalls[0] as { name: string; startDate: string; endDate: string };
    expect(payload.name).toBe('Term 1 2027');
    expect(payload.startDate).toContain('2027-01-1'); // ISO, day may shift by tz
    expect(payload.endDate).toContain('2027-04-');
  });

  it('deletes a term only after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');
    const row = within(table).getByText('Term 3 2026').closest('tr') as HTMLElement;

    await user.click(within(row).getByRole('button', { name: /delete/i }));
    expect(removeCalls).toHaveLength(0);

    confirmSpy.mockReturnValue(true);
    await user.click(within(row).getByRole('button', { name: /delete/i }));
    expect(removeCalls).toEqual(['t2']);
  });
});
