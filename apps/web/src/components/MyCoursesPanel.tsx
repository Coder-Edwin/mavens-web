import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Panel, ProgressBar } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import { coursesApi, coursePercent, type CourseAssignment } from '@/lib/courses';

// Compact course-progress panel for the student dashboard.
export function MyCoursesPanel() {
  const [rows, setRows] = useState<CourseAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    coursesApi
      .mine()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load courses.'));
  }, []);

  if (error) {
    return (
      <Panel title="My courses">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)' }}>{error}</div>
      </Panel>
    );
  }
  if (!rows) {
    return (
      <Panel title="My courses">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>Loading…</div>
      </Panel>
    );
  }
  if (rows.length === 0) {
    return (
      <Panel title="My courses">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
          No courses assigned yet.
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="My courses">
      {rows.slice(0, 4).map((a) => (
        <Link
          key={a.id}
          to={`/app/learn/${a.courseId}`}
          style={{
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
            padding: '8px 0',
            borderBottom: '1px solid var(--line)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
            <span>{a.course?.title ?? 'Course'}</span>
            <span className="mono" style={{ color: 'var(--muted)', fontSize: 12 }}>
              {a.progress ? `${a.progress.done}/${a.progress.total}` : ''}
            </span>
          </div>
          <div style={{ marginTop: 6 }}>
            <ProgressBar percent={coursePercent(a)} />
          </div>
        </Link>
      ))}
      {rows.length > 4 && (
        <Link to="/app/learn" style={{ fontSize: 12, color: 'var(--gold-soft)', display: 'inline-block', marginTop: 8 }}>
          See all {rows.length} courses →
        </Link>
      )}
    </Panel>
  );
}
