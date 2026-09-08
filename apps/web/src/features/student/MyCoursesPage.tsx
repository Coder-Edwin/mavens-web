import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Panel, ProgressBar, Chip } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  coursesApi,
  coursePercent,
  ASSIGNMENT_STATUS_LABEL,
  type CourseAssignment
} from '@/lib/courses';
import { LEVEL_LABEL } from '@/lib/enrollments';

function statusChip(s: CourseAssignment['status']): { cls: 'paid' | 'overdue' | 'pending'; label: string } {
  if (s === 'COMPLETED') return { cls: 'paid', label: ASSIGNMENT_STATUS_LABEL[s] };
  if (s === 'IN_PROGRESS') return { cls: 'pending', label: ASSIGNMENT_STATUS_LABEL[s] };
  return { cls: 'pending', label: ASSIGNMENT_STATUS_LABEL[s] };
}

export function MyCoursesPage() {
  const [rows, setRows] = useState<CourseAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    coursesApi
      .mine()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your courses.'));
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">My courses</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to my progress
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {!rows && <div className="page-sub">Loading…</div>}
      {rows && rows.length === 0 && (
        <Panel title="Nothing assigned yet">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
            Your coach hasn't assigned any courses yet.
          </p>
        </Panel>
      )}
      {rows && rows.length > 0 && (
        <div className="grid-2">
          {rows.map((a) => {
            const pct = coursePercent(a);
            const chip = statusChip(a.status);
            return (
              <Link
                key={a.id}
                to={`/app/learn/${a.courseId}`}
                className="panel"
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div className="panel-head">
                  <div className="panel-title">{a.course?.title ?? 'Course'}</div>
                  <Chip status={chip.cls} label={chip.label} />
                </div>
                {a.course?.summary && (
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
                    {a.course.summary}
                  </div>
                )}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                  {a.course?.level ? LEVEL_LABEL[a.course.level].toUpperCase() : 'ALL LEVELS'} ·{' '}
                  {a.progress ? `${a.progress.done}/${a.progress.total} lessons` : ''}
                </div>
                <ProgressBar percent={pct} />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
