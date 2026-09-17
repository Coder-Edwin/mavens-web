import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentPuzzles } from './StudentPuzzles';

const postCalls: string[] = [];
let getImpl: () => Promise<unknown>;

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: () => getImpl(),
      post: (path: string) => {
        postCalls.push(path);
        return Promise.resolve({});
      }
    }
  };
});

const assignment = (over: Record<string, unknown> = {}) => ({
  id: 'pa-1',
  dueDate: null,
  status: 'NEW',
  puzzleSet: { id: 'ps-1', title: 'Rook Endgames', description: null, difficulty: 'Intermediate' },
  submission: null,
  ...over
});

beforeEach(() => {
  postCalls.length = 0;
  getImpl = async () => [assignment()];
});

describe('StudentPuzzles', () => {
  it('gives the Puzzles nav item a real page showing assigned puzzles', async () => {
    render(<StudentPuzzles />);
    expect(await screen.findByText('Rook Endgames')).toBeInTheDocument();
    expect(screen.getByText('Puzzles')).toBeInTheDocument();
  });

  it('submits a new puzzle as done', async () => {
    const user = userEvent.setup();
    render(<StudentPuzzles />);
    await screen.findByText('Rook Endgames');

    await user.click(screen.getByRole('button', { name: /mark as done/i }));

    expect(postCalls).toEqual(['/puzzle-assignments/pa-1/submit']);
  });

  it('shows an empty state when nothing is assigned', async () => {
    getImpl = async () => [];
    render(<StudentPuzzles />);
    expect(await screen.findByText(/hasn't assigned any puzzles yet/i)).toBeInTheDocument();
  });
});
