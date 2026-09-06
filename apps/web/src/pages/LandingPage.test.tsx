import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from './LandingPage';

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

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

    // Each expected heading appears, and in this relative order.
    const positions = order.map((t) => headings.findIndex((h) => h === t));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('puts sign-in and join CTAs in the header pointing at the right routes', () => {
    renderLanding();
    const header = screen.getByRole('banner');

    const signIn = within(header).getByRole('link', { name: /sign in/i });
    const join = within(header).getByRole('link', { name: /join the club/i });

    expect(signIn).toHaveAttribute('href', '/login');
    expect(join).toHaveAttribute('href', '/join');
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
});
