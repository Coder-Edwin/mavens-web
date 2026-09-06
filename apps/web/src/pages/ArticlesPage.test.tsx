import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ArticlesPage } from './ArticlesPage';
import { ApiError } from '@/lib/api-client';
import type { ArticleSummary } from '@/lib/articles';

// Plain stub (not vi.fn) — see the note in ArticlePage.test.tsx.
let impl: () => Promise<ArticleSummary[]>;

vi.mock('@/lib/articles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/articles')>();
  return {
    ...actual,
    articlesApi: { ...actual.articlesApi, listPublic: () => impl() }
  };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ArticlesPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  impl = async () => [];
});

describe('ArticlesPage', () => {
  it('lists published articles with links to their permalink', async () => {
    impl = async () => [
      { id: '1', slug: 'a-one', title: 'Article One', excerpt: 'First.', coverImageUrl: null, publishedAt: '2026-08-01T00:00:00Z' },
      { id: '2', slug: 'a-two', title: 'Article Two', excerpt: 'Second.', coverImageUrl: null, publishedAt: '2026-09-01T00:00:00Z' }
    ];
    renderPage();

    expect(await screen.findByRole('link', { name: /article one/i })).toHaveAttribute('href', '/articles/a-one');
    expect(screen.getByRole('link', { name: /article two/i })).toHaveAttribute('href', '/articles/a-two');
  });

  it('shows an empty state when nothing is published', async () => {
    impl = async () => [];
    renderPage();
    expect(await screen.findByText(/no articles have been published yet/i)).toBeInTheDocument();
  });

  it('shows an error state when the request fails', async () => {
    impl = async () => {
      throw new ApiError(500, 'boom');
    };
    renderPage();
    expect(await screen.findByText(/could not load articles right now/i)).toBeInTheDocument();
  });
});
