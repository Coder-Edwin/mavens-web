import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LeadsAdmin } from './LeadsAdmin';
import type { Lead, LeadStatus } from '@/lib/leads';

const listCalls: (LeadStatus | undefined)[] = [];
const updateCalls: { id: string; patch: { status?: LeadStatus; notes?: string } }[] = [];
const removeCalls: string[] = [];
let listImpl: (status?: LeadStatus) => Promise<Lead[]>;

vi.mock('@/lib/leads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/leads')>();
  return {
    ...actual,
    leadsApi: {
      ...actual.leadsApi,
      list: (status?: LeadStatus) => {
        listCalls.push(status);
        return listImpl(status);
      },
      update: (id: string, patch: { status?: LeadStatus; notes?: string }) => {
        updateCalls.push({ id, patch });
        return Promise.resolve({} as Lead);
      },
      remove: (id: string) => {
        removeCalls.push(id);
        return Promise.resolve({ id });
      }
    }
  };
});

const lead = (over: Partial<Lead>): Lead => ({
  id: 'l1',
  parentName: 'Grace Wambui',
  email: 'grace@example.com',
  phone: '254712345678',
  childName: 'Faith',
  childAge: 9,
  message: null,
  status: 'NEW',
  notes: null,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  ...over
});

function renderAdmin() {
  return render(
    <MemoryRouter>
      <LeadsAdmin />
    </MemoryRouter>
  );
}

beforeEach(() => {
  listCalls.length = 0;
  updateCalls.length = 0;
  removeCalls.length = 0;
  listImpl = async () => [
    lead({ id: 'l1', parentName: 'Grace Wambui', email: 'grace@example.com', status: 'NEW' }),
    lead({
      id: 'l2',
      parentName: 'John Otieno',
      email: 'john@example.com',
      status: 'CONTACTED',
      childName: null,
      childAge: null
    })
  ];
});

describe('LeadsAdmin', () => {
  it('loads all leads on mount and lists their contact details', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Grace Wambui')).toBeInTheDocument();
    expect(within(table).getByText('John Otieno')).toBeInTheDocument();
    expect(within(table).getByText('grace@example.com')).toBeInTheDocument();
    expect(listCalls).toEqual([undefined]); // 'ALL' -> no status param
  });

  it('re-queries with a status filter when a tab is picked', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Contacted' }));
    expect(listCalls).toContain('CONTACTED');
  });

  it('updates a lead status from the row dropdown', async () => {
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');

    const row = within(table).getByText('Grace Wambui').closest('tr')!;
    await user.selectOptions(within(row).getByRole('combobox'), 'ENROLLED');

    expect(updateCalls[0]).toEqual({ id: 'l1', patch: { status: 'ENROLLED' } });
  });

  it('deletes a lead only after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');
    const row = within(table).getByText('Grace Wambui').closest('tr')!;

    await user.click(within(row).getByRole('button', { name: /delete/i }));
    expect(removeCalls).toHaveLength(0);

    confirmSpy.mockReturnValue(true);
    await user.click(within(row).getByRole('button', { name: /delete/i }));
    expect(removeCalls).toEqual(['l1']);
  });
});
