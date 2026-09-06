import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ArticlesAdmin } from './ArticlesAdmin';

const listAdmin = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
vi.mock('@/lib/articles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/articles')>();
  return {
    ...actual,
    articlesApi: {
      ...actual.articlesApi,
      listAdmin: () => listAdmin(),
      create: (i: unknown) => create(i),
      update: (id: string, i: unknown) => update(id, i),
      remove: (id: string) => remove(id)
    }
  };
});

const rows = [
  {
    id: 'a1',
    slug: 'club-news',
    title: 'Club News',
    excerpt: 'Latest.',
    body: 'Body text.',
    coverImageUrl: null,
    status: 'PUBLISHED' as const,
    publishedAt: '2026-09-01T00:00:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-02T00:00:00Z',
    author: { email: 'amwai@mavenschessclub.com' }
  },
  {
    id: 'a2',
    slug: 'draft-post',
    title: 'Draft Post',
    excerpt: 'WIP.',
    body: 'Draft body.',
    coverImageUrl: null,
    status: 'DRAFT' as const,
    publishedAt: null,
    createdAt: '2026-09-03T00:00:00Z',
    updatedAt: '2026-09-03T00:00:00Z',
    author: { email: 'amwai@mavenschessclub.com' }
  }
];

function renderAdmin() {
  return render(
    <MemoryRouter>
      <ArticlesAdmin />
    </MemoryRouter>
  );
}

beforeEach(() => {
  listAdmin.mockReset().mockResolvedValue(rows);
  create.mockReset().mockResolvedValue(rows[0]);
  update.mockReset().mockResolvedValue(rows[0]);
  remove.mockReset().mockResolvedValue({ id: 'a1' });
});

describe('ArticlesAdmin', () => {
  it('lists every article including drafts with their status', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');

    const publishedRow = within(table).getByText('Club News').closest('tr')!;
    const draftRow = within(table).getByText('Draft Post').closest('tr')!;

    expect(within(publishedRow).getByText('Published', { selector: '.chip' })).toBeInTheDocument();
    expect(within(draftRow).getByText('Draft', { selector: '.chip' })).toBeInTheDocument();
  });

  it('creates a new article from the form', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: /new article/i }));
    await user.type(screen.getByLabelText(/title/i), 'A Fresh Post');
    await user.type(screen.getByLabelText(/excerpt/i), 'Short summary.');
    await user.type(screen.getByLabelText(/body/i), 'The full body.');
    await user.click(screen.getByRole('button', { name: /create article/i }));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'A Fresh Post', excerpt: 'Short summary.', body: 'The full body.' })
    );
    expect(listAdmin).toHaveBeenCalledTimes(2); // initial + refresh
  });

  it('clears the cover image on edit when the field is emptied', async () => {
    listAdmin.mockReset().mockResolvedValue([
      { ...rows[0], id: 'a9', title: 'Has Image', coverImageUrl: 'https://img.example/x.jpg' }
    ]);
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');

    const tr = within(table).getByText('Has Image').closest('tr')!;
    await user.click(within(tr).getByRole('button', { name: /edit/i }));

    await user.clear(screen.getByLabelText(/cover image url/i));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(update).toHaveBeenCalledWith('a9', expect.objectContaining({ coverImageUrl: null }));
  });

  it('omits the cover image on create when the field is blank', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: /new article/i }));
    await user.type(screen.getByLabelText(/title/i), 'No Image Post');
    await user.type(screen.getByLabelText(/excerpt/i), 'x');
    await user.type(screen.getByLabelText(/body/i), 'y');
    await user.click(screen.getByRole('button', { name: /create article/i }));

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ coverImageUrl: undefined }));
  });

  it('toggles publish state on an existing row', async () => {
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');

    const draftRow = within(table).getByText('Draft Post').closest('tr')!;
    await user.click(within(draftRow).getByRole('button', { name: /^publish$/i }));

    expect(update).toHaveBeenCalledWith('a2', { status: 'PUBLISHED' });
  });

  it('deletes a row after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');

    const row = within(table).getByText('Club News').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /delete/i }));

    expect(remove).toHaveBeenCalledWith('a1');
  });

  it('does not delete when confirmation is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');

    const row = within(table).getByText('Club News').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /delete/i }));

    expect(remove).not.toHaveBeenCalled();
  });
});
