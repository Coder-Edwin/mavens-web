import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnnouncementsPanel } from './AnnouncementsPanel';
import type { FeedAnnouncement } from '@/lib/announcements';

// Plain stub (not vi.fn) so a rejecting impl isn't flagged as an unhandled
// rejection by vitest's mock-result tracking.
let impl: () => Promise<FeedAnnouncement[]>;
vi.mock('@/lib/announcements', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/announcements')>();
  return { ...actual, announcementsApi: { ...actual.announcementsApi, feed: () => impl() } };
});

beforeEach(() => {
  impl = async () => [];
});

describe('AnnouncementsPanel', () => {
  it('renders nothing when there are no announcements', async () => {
    const { container } = render(<AnnouncementsPanel />);
    // allow the effect to resolve
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the feed request fails', async () => {
    impl = async () => {
      throw new Error('offline');
    };
    const { container } = render(<AnnouncementsPanel />);
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the announcements it receives', async () => {
    impl = async () => [
      { id: '1', title: 'Club closed Friday', body: 'Public holiday.', audience: 'ALL', createdAt: '2026-09-01T00:00:00Z' },
      { id: '2', title: 'New term dates', body: 'Starts Sept 15.', audience: 'PARENTS', createdAt: '2026-09-02T00:00:00Z' }
    ];
    render(<AnnouncementsPanel />);

    expect(await screen.findByText('Club closed Friday')).toBeInTheDocument();
    expect(screen.getByText('New term dates')).toBeInTheDocument();
    expect(screen.getByText('Public holiday.')).toBeInTheDocument();
  });
});
