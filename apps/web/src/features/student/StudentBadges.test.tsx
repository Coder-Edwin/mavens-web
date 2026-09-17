import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudentBadges } from './StudentBadges';
import type { StudentBadge } from '@/lib/badges';

let mineImpl: () => Promise<StudentBadge[]>;

vi.mock('@/lib/badges', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/badges')>();
  return {
    ...actual,
    badgesApi: { mine: () => mineImpl() }
  };
});

const earned = (over: Partial<StudentBadge> = {}): StudentBadge => ({
  studentId: 'stu-1',
  badgeId: 'badge-1',
  earnedAt: '2026-09-01T00:00:00Z',
  badge: { id: 'badge-1', name: 'First Tournament Win', icon: '🏆', criteria: 'Won a rated game' },
  ...over
});

beforeEach(() => {
  mineImpl = async () => [];
});

describe('StudentBadges', () => {
  it('shows an empty state when nothing has been awarded yet', async () => {
    render(<StudentBadges />);
    expect(await screen.findByText(/no badges yet/i)).toBeInTheDocument();
  });

  it('lists earned badges with their icon and criteria', async () => {
    mineImpl = async () => [earned()];
    render(<StudentBadges />);
    expect(await screen.findByText('First Tournament Win')).toBeInTheDocument();
    expect(screen.getByText('🏆')).toBeInTheDocument();
    expect(screen.getByText('Won a rated game')).toBeInTheDocument();
  });
});
