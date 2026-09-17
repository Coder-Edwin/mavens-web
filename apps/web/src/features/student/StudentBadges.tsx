import { useEffect, useState } from 'react';
import { Panel } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import { badgesApi, type StudentBadge } from '@/lib/badges';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function StudentBadges() {
  const [badges, setBadges] = useState<StudentBadge[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    badgesApi
      .mine()
      .then(setBadges)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your badges.'));
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Badges</div>
          <div className="page-sub">Recognition your coach has awarded you</div>
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {!badges ? (
        <div className="page-sub">Loading…</div>
      ) : badges.length === 0 ? (
        <Panel title="No badges yet">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
            Keep training — your coach will award badges here as you hit milestones.
          </p>
        </Panel>
      ) : (
        <div className="grid-3">
          {badges.map((b) => (
            <div
              key={b.badgeId}
              className="panel"
              style={{ textAlign: 'center', padding: '24px 16px' }}
            >
              <div style={{ fontSize: 40, marginBottom: 8 }}>{b.badge.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{b.badge.name}</div>
              {b.badge.criteria && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{b.badge.criteria}</div>
              )}
              <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
                Earned {formatDate(b.earnedAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
