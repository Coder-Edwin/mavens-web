import { Link } from 'react-router-dom';
import { SessionAgenda } from '@/components/SessionAgenda';

export function SchedulePage() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">This week</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>{' '}
            ·{' '}
            <Link to="/app/class-schedules" style={{ color: 'var(--gold-soft)' }}>
              Class schedules
            </Link>
          </div>
        </div>
      </div>
      <SessionAgenda title="Sessions" />
    </>
  );
}
