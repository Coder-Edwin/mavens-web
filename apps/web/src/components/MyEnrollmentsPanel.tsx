import { useEffect, useState } from 'react';
import { Panel, Chip } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  enrollmentsApi,
  enrollmentStatusChip,
  DELIVERY_LABEL,
  LEVEL_LABEL,
  formatCrmDate,
  type Enrollment
} from '@/lib/enrollments';

// Read-only enrollment + level summary for the student, parent and coach
// portals (GET /enrollments/mine adapts to the caller's role).
// `showStudentName` is on for parents/coaches (multiple people), off for a
// student looking at their own record.
export function MyEnrollmentsPanel({
  showStudentName = false,
  title,
  emptyText = 'No enrollment on file yet. The club office will set this up after your placement.'
}: {
  showStudentName?: boolean;
  title?: string;
  emptyText?: string;
}) {
  const [rows, setRows] = useState<Enrollment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const heading = title ?? (rows && rows.length > 1 ? 'Enrollments' : 'Enrollment');

  useEffect(() => {
    enrollmentsApi
      .mine()
      .then(setRows)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Could not load your enrollment.')
      );
  }, []);

  if (error) {
    return (
      <Panel title={heading}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)' }}>{error}</div>
      </Panel>
    );
  }

  if (!rows) {
    return (
      <Panel title={heading}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>Loading…</div>
      </Panel>
    );
  }

  if (rows.length === 0) {
    return (
      <Panel title={heading}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
          {emptyText}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title={heading}>
      <table>
        <thead>
          <tr>
            {showStudentName && <th>Student</th>}
            <th>Delivery</th>
            <th>Level</th>
            <th>Status</th>
            <th>Since</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const chip = enrollmentStatusChip(r.status);
            return (
              <tr key={r.id}>
                {showStudentName && (
                  <td style={{ fontWeight: 600 }}>
                    {r.student ? `${r.student.firstName} ${r.student.lastName}` : '—'}
                  </td>
                )}
                <td style={{ fontSize: 13 }}>
                  {DELIVERY_LABEL[r.deliveryType]}
                  {r.schoolGroup && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {r.schoolGroup.institutionName}
                    </div>
                  )}
                </td>
                <td style={{ fontSize: 13 }}>{r.level ? LEVEL_LABEL[r.level] : 'Not yet placed'}</td>
                <td>
                  <Chip status={chip.cls} label={chip.label} />
                </td>
                <td className="mono" style={{ fontSize: 12 }}>
                  {formatCrmDate(r.startDate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
