import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ArticlePage } from './ArticlePage';
import { ApiError } from '@/lib/api-client';
import type { ArticleDetail } from '@/lib/articles';

// A plain (non-vi.fn) stub: vitest's mock-result tracking otherwise flags a
// mocked function that returns a rejected promise as an "unhandled rejection"
// even when the component catches it.
const calls: string[] = [];
let impl: (slug: string) => Promise<ArticleDetail>;

vi.mock('@/lib/articles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/articles')>();
  return {
    ...actual,
    articlesApi: {
      ...actual.articlesApi,
      getBySlug: (slug: string) => {
        calls.push(slug);
        return impl(slug);
      }
    }
  };
});

const sample: ArticleDetail = {
  id: '1',
  slug: 'rook-endgames',
  title: 'Rook Endgames',
  excerpt: 'The essentials.',
  body: 'First paragraph.\n\nSecond paragraph.',
  coverImageUrl: null,
  publishedAt: '2026-09-01T00:00:00Z'
};

function renderAt(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/articles/${slug}`]}>
      <Routes>
        <Route path="/articles/:slug" element={<ArticlePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  calls.length = 0;
  impl = async () => sample;
});

describe('ArticlePage', () => {
  it('renders the post title, dateline and body split into paragraphs', async () => {
    renderAt('rook-endgames');

    expect(await screen.findByRole('heading', { level: 1, name: 'Rook Endgames' })).toBeInTheDocument();
    expect(screen.getByText('First paragraph.')).toBeInTheDocument();
    expect(screen.getByText('Second paragraph.')).toBeInTheDocument();
    expect(calls).toContain('rook-endgames');
  });

  it('shows a not-found message for a 404', async () => {
    impl = async () => {
      throw new ApiError(404, 'Article not found');
    };
    renderAt('missing');
    expect(await screen.findByText(/doesn.t exist or hasn.t been published/i)).toBeInTheDocument();
  });

  it('shows a generic error for non-404 failures', async () => {
    impl = async () => {
      throw new ApiError(500, 'boom');
    };
    renderAt('rook-endgames');
    expect(await screen.findByText(/something went wrong loading this article/i)).toBeInTheDocument();
  });
});
