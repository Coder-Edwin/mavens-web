import { useEffect, useState } from 'react';
import { Panel } from '@/components/ui/Primitives';
import {
  announcementsApi,
  formatAnnouncementDate,
  type FeedAnnouncement
} from '@/lib/announcements';

/**
 * Dashboard widget: shows the announcements broadcast to the current user's
 * group. Renders nothing at all when there are none, so it stays out of the
 * way on quiet weeks.
 */
export function AnnouncementsPanel() {
  const [items, setItems] = useState<FeedAnnouncement[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const feed = await announcementsApi.feed();
        if (!cancelled) setItems(feed);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed || !items || items.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <Panel title="Announcements">
        {items.map((a) => (
          <div className="feed-item" key={a.id}>
            <div className="feed-dot" />
            <div>
              <div className="feed-text">
                <b>{a.title}</b>
                <div style={{ whiteSpace: 'pre-wrap', marginTop: 2 }}>{a.body}</div>
              </div>
              <div className="feed-time">{formatAnnouncementDate(a.createdAt)}</div>
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}
