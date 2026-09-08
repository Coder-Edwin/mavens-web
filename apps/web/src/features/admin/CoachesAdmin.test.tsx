import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CoachesAdmin } from './CoachesAdmin';
import type { Coach } from '@/lib/coaches';

const createCalls: unknown[] = [];
const updateCalls: { id: string; patch: unknown }[] = [];
let listImpl: () => Promise<Coach[]>;

vi.mock('@/lib/coaches', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/coaches')>();
  return {
    ...actual,
    coachesApi: {
      list: () => listImpl(),
      get: vi.fn(),
      create: (input: unknown) => {
        createCalls.push(input);
        return Promise.resolve({
          coach: { id: 'c9', firstName: 'New', lastName: 'Coach', user: { email: 'new@x.com' } },
          tempPassword: 'temp123'
        });
      },
      update: (id: string, patch: unknown) => {
        updateCalls.push({ id, patch });
        return Promise.resolve({ id } as Coach);
      }
    }
  };
});

const coach = (over: Partial<Coach>): Coach => ({
  id: 'c1',
  firstName: 'Brian',
  lastName: 'Otieno',
  phone: null,
  bio: null,
  specialty: 'Endgames',
  skills: null,
  employmentType: 'STAFF',
  createdAt: '2026-09-01T00:00:00Z',
  user: { email: 'brian@example.com', isActive: true },
  ...over
});

function renderAdmin() {
  return render(
    <MemoryRouter>
      <CoachesAdmin />
    </MemoryRouter>
  );
}

beforeEach(() => {
  createCalls.length = 0;
  updateCalls.length = 0;
  listImpl = async () => [coach({ id: 'c1' }), coach({ id: 'c2', firstName: null, lastName: null })];
});

describe('CoachesAdmin', () => {
  it('lists coaches, falling back to the email when there is no name', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Brian Otieno')).toBeInTheDocument();
    // c2 has no name -> shows its email as the display name
    expect(within(table).getAllByText('brian@example.com').length).toBeGreaterThan(0);
  });

  it('creates a coach and surfaces the temp password', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'New coach' }));
    await user.type(screen.getByLabelText('First name'), 'New');
    await user.type(screen.getByLabelText('Last name'), 'Coach');
    await user.type(screen.getByLabelText(/Login email/), 'new@x.com');
    await user.click(screen.getByRole('button', { name: 'Create coach' }));

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({ email: 'new@x.com', firstName: 'New', lastName: 'Coach' });
    expect(await screen.findByText(/Temp password:/)).toBeInTheDocument();
  });

  it('edits a coach without letting the email change', async () => {
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');
    const row = within(table).getByText('Brian Otieno').closest('tr') as HTMLElement;

    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText(/Login email/)).toBeDisabled();

    await user.clear(screen.getByLabelText(/Specialty/));
    await user.type(screen.getByLabelText(/Specialty/), 'Openings');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateCalls[0]).toMatchObject({ id: 'c1', patch: { specialty: 'Openings' } });
  });
});
