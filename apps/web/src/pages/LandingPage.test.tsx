import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from './LandingPage';

// Plain stub (not vi.fn) so a rejected-promise return isn't flagged as an
// unhandled rejection by vitest's mock-result tracking.
const listPublicCalls: unknown[][] = [];
let listPublicImpl: (...args: unknown[]) => Promise<unknown[]>;

vi.mock('@/lib/articles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/articles')>();
  return {
    ...actual,
    articlesApi: {
      ...actual.articlesApi,
      listPublic: (...args: unknown[]) => {
        listPublicCalls.push(args);
        return listPublicImpl(...args);
      }
    }
  };
});

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  listPublicCalls.length = 0;
  listPublicImpl = async () => []; // default: no articles yet
});

describe('LandingPage', () => {
  it('renders every marketing section in the expected order', () => {
    renderLanding();

    const order = [
      'A home for scholastic chess in Kenya', // About
      'Programs',
      'Meet the coach behind Mavens', // Founder
      'Meet our coaches',
      'Donors & partners',
      'Latest articles',
      'Ready to make your move?' // CTA band
    ];

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent?.trim());

    const positions = order.map((t) => headings.findIndex((h) => h === t));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('puts sign-in and join CTAs in the header pointing at the right routes', () => {
    renderLanding();
    const header = screen.getByRole('banner');

    expect(within(header).getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
    expect(within(header).getByRole('link', { name: /join the club/i })).toHaveAttribute('href', '/join');
  });

  it('surfaces real club facts pulled from the existing site', () => {
    renderLanding();
    expect(screen.getByText(/Coach Tom Amwai/)).toBeInTheDocument();
    expect(screen.getByText(/Learn\. Grow\. Enjoy\. Play chess\./)).toBeInTheDocument();
    expect(screen.getByText(/A108 Westlands Road, Nairobi/)).toBeInTheDocument();
  });

  it('marks placeholder content so it is not mistaken for real data', () => {
    renderLanding();
    expect(screen.getAllByText(/placeholder/i).length).toBeGreaterThan(0);
  });

  it('requests the three latest published articles for the strip', () => {
    renderLanding();
    expect(listPublicCalls).toContainEqual([3]);
  });

  it('renders published articles as links into /articles/:slug when the API returns some', async () => {
    listPublicImpl = async () => [
      { id: '1', slug: 'rook-endgames', title: 'Rook Endgames', excerpt: 'Lucena and Philidor.', coverImageUrl: null, publishedAt: '2026-09-01T00:00:00Z' }
    ];
    renderLanding();

    const link = await screen.findByRole('link', { name: /rook endgames/i });
    expect(link).toHaveAttribute('href', '/articles/rook-endgames');
    expect(screen.getByRole('link', { name: /view all articles/i })).toHaveAttribute('href', '/articles');
  });

  it('shows a graceful message instead of breaking when the articles API fails', async () => {
    listPublicImpl = async () => {
      throw new Error('network');
    };
    renderLanding();
    expect(await screen.findByText(/articles are unavailable right now/i)).toBeInTheDocument();
  });
});
