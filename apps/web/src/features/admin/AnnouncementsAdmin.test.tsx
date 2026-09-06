import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AnnouncementsAdmin } from './AnnouncementsAdmin';
import type { AdminAnnouncement, AnnouncementInput } from '@/lib/announcements';

const listCalls: number[] = [];
const createCalls: AnnouncementInput[] = [];
const removeCalls: string[] = [];
let listImpl: () => Promise<AdminAnnouncement[]>;

vi.mock('@/lib/announcements', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/announcements')>();
  return {
    ...actual,
    announcementsApi: {
      ...actual.announcementsApi,
      listAdmin: () => {
        listCalls.push(1);
        return listImpl();
      },
      create: (input: AnnouncementInput) => {
        createCalls.push(input);
        return Promise.resolve({} as AdminAnnouncement);
      },
      remove: (id: string) => {
        removeCalls.push(id);
        return Promise.resolve({ id });
      }
    }
  };
});

const row: AdminAnnouncement = {
  id: 'x1',
  title: 'Club closed Friday',
  body: 'Public holiday.',
  audience: 'ALL',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  author: { email: 'amwai@mavenschessclub.com' }
};

function renderAdmin() {
  return render(
    <MemoryRouter>
      <AnnouncementsAdmin />
    </MemoryRouter>
  );
}

beforeEach(() => {
  listCalls.length = 0;
  createCalls.length = 0;
  removeCalls.length = 0;
  listImpl = async () => [row];
});

describe('AnnouncementsAdmin', () => {
  it('lists sent announcements with their audience', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Club closed Friday')).toBeInTheDocument();
    expect(within(table).getByText('Everyone')).toBeInTheDocument();
  });

  it('broadcasts a new announcement to the chosen audience', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    const form = screen.getByRole('form', { name: /new announcement/i });
    await user.type(within(form).getByLabelText(/title/i), 'Half-term break');
    await user.type(within(form).getByLabelText(/message/i), 'No classes next week.');
    await user.selectOptions(within(form).getByLabelText(/send to/i), 'PARENTS');
    await user.click(within(form).getByRole('button', { name: /send announcement/i }));

    expect(createCalls[0]).toEqual({
      title: 'Half-term break',
      body: 'No classes next week.',
      audience: 'PARENTS'
    });
    expect(listCalls.length).toBe(2); // initial load + refresh after send
  });

  it('deletes an announcement after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');

    const tr = within(table).getByText('Club closed Friday').closest('tr')!;
    await user.click(within(tr).getByRole('button', { name: /delete/i }));

    expect(removeCalls).toEqual(['x1']);
  });
});
