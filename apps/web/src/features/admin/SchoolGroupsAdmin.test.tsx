import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SchoolGroupsAdmin } from './SchoolGroupsAdmin';
import type { SchoolGroup, SchoolGroupStatus } from '@/lib/school-groups';

const listCalls: (SchoolGroupStatus | undefined)[] = [];
const createCalls: unknown[] = [];
const removeCalls: string[] = [];
let listImpl: (status?: SchoolGroupStatus) => Promise<SchoolGroup[]>;

vi.mock('@/lib/school-groups', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/school-groups')>();
  return {
    ...actual,
    schoolGroupsApi: {
      list: (status?: SchoolGroupStatus) => {
        listCalls.push(status);
        return listImpl(status);
      },
      get: vi.fn(),
      create: (input: unknown) => {
        createCalls.push(input);
        return Promise.resolve({ id: 'new' } as SchoolGroup);
      },
      update: vi.fn().mockResolvedValue({} as SchoolGroup),
      remove: (id: string) => {
        removeCalls.push(id);
        return Promise.resolve({ id });
      }
    }
  };
});

const group = (over: Partial<SchoolGroup>): SchoolGroup => ({
  id: 'sg1',
  institutionName: 'Riverside Academy',
  address: '12 Ngong Rd',
  coordinatorName: 'Jane Doe',
  coordinatorPhone: '+254700000000',
  coordinatorEmail: 'jane@riverside.ac.ke',
  agreedGroupSize: 20,
  status: 'ACTIVE',
  notes: null,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  _count: { enrollments: 3 },
  ...over
});

function renderAdmin() {
  return render(
    <MemoryRouter>
      <SchoolGroupsAdmin />
    </MemoryRouter>
  );
}

beforeEach(() => {
  listCalls.length = 0;
  createCalls.length = 0;
  removeCalls.length = 0;
  listImpl = async () => [
    group({ id: 'sg1', institutionName: 'Riverside Academy', status: 'ACTIVE' }),
    group({ id: 'sg2', institutionName: 'Hilltop School', status: 'PROSPECT', _count: { enrollments: 0 } })
  ];
});

describe('SchoolGroupsAdmin', () => {
  it('lists school groups with their enrollment counts', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Riverside Academy')).toBeInTheDocument();
    expect(within(table).getByText('Hilltop School')).toBeInTheDocument();
    expect(listCalls).toEqual([undefined]);
  });

  it('re-queries with a status filter when a tab is picked', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Prospect' }));
    expect(listCalls).toContain('PROSPECT');
  });

  it('creates a school group from the form', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'New school group' }));
    await user.type(screen.getByLabelText('Institution name'), 'New College');
    await user.click(screen.getByRole('button', { name: 'Create school group' }));

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({ institutionName: 'New College', status: 'PROSPECT' });
  });

  it('deletes a group only after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');
    const row = within(table).getByText('Hilltop School').closest('tr') as HTMLElement;

    await user.click(within(row).getByRole('button', { name: /delete/i }));
    expect(removeCalls).toHaveLength(0);

    confirmSpy.mockReturnValue(true);
    await user.click(within(row).getByRole('button', { name: /delete/i }));
    expect(removeCalls).toEqual(['sg2']);
  });
});
