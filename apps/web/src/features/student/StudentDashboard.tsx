import { useEffect, useState } from 'react';
import { Panel } from '@/components/ui/Primitives';
import { api, ApiError } from '@/lib/api-client';

interface PuzzleSetSummary {
  id: string;
  title: string;
  description?: string | null;
  difficulty?: string | null;
}

interface Submission {
  id: string;
  score: number | null;
  feedback: string | null;
}

interface Assignment {
  id: string;
  dueDate: string | null;
  status: 'NEW' | 'SUBMITTED' | 'GRADED';
  puzzleSet: PuzzleSetSummary;
  submission: Submission | null;
}

const STATUS_LABEL: Record<Assignment['status'], string> = {
  NEW: 'NEW',
  SUBMITTED: 'SUBMITTED',
  GRADED: 'GRADED'
};

// Maps our backend enum to the CSS classes already defined in tokens.css
// (.status-pill.new / .review / .graded) — the class names predate the
// SUBMITTED status name, so this mapping keeps the visual design intact.
const STATUS_CLASS: Record<Assignment['status'], string> = {
  NEW: 'new',
  SUBMITTED: 'review',
  GRADED: 'graded'
};

export function StudentDashboard() {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  async function loadAssignments() {
    try {
      const data = await api.get<Assignment[]>('/puzzle-assignments');
      setAssignments(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your puzzles.');
    }
  }

  useEffect(() => {
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(id: string) {
    setSubmittingId(id);
    try {
      await api.post(`/puzzle-assignments/${id}/submit`);
      await loadAssignments(); // re-fetch so the card reflects the new SUBMITTED status
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit this puzzle.');
    } finally {
      setSubmittingId(null);
    }
  }

  if (error) {
    return (
      <div className="panel" style={{ borderColor: 'var(--red)' }}>
        <div className="panel-title">Something went wrong</div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{error}</p>
      </div>
    );
  }

  if (!assignments) {
    return <div className="page-sub">Loading your puzzles…</div>;
  }

  const newCount = assignments.filter((a) => a.status === 'NEW').length;

  return (
    <>
      <div className="streak-banner">
        <div>
          <h2>Welcome back 👋</h2>
          <p>
            {newCount > 0
              ? `YOU HAVE ${newCount} NEW PUZZLE${newCount === 1 ? '' : 'S'} TO SOLVE`
              : "YOU'RE ALL CAUGHT UP"}
          </p>
        </div>
      </div>

      <div className="page-head">
        <div className="page-title" style={{ fontSize: 19 }}>
          Assigned Puzzles
        </div>
      </div>

      {assignments.length === 0 ? (
        <Panel title="No puzzles yet">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
            Your coach hasn't assigned any puzzles yet. Check back after your next lesson.
          </p>
        </Panel>
      ) : (
        <div className="grid-3">
          {assignments.map((a) => (
            <div className="puzzle-card" key={a.id}>
              <span className={`status-pill ${STATUS_CLASS[a.status]}`}>
                {a.status === 'GRADED' && a.submission?.score != null
                  ? `GRADED · ${a.submission.score}/100`
                  : STATUS_LABEL[a.status]}
              </span>
              <div className="puzzle-board" />
              <div className="puzzle-title">{a.puzzleSet.title}</div>
              <div className="puzzle-tag">
                {a.status === 'GRADED' && a.submission?.feedback
                  ? `"${a.submission.feedback}"`
                  : a.dueDate
                    ? `Due ${new Date(a.dueDate).toLocaleDateString()}`
                    : (a.puzzleSet.difficulty ?? 'No due date')}
              </div>
              {a.status === 'NEW' && (
                <button
                  className="btn btn-gold btn-sm"
                  style={{ marginTop: 10, width: '100%' }}
                  disabled={submittingId === a.id}
                  onClick={() => handleSubmit(a.id)}
                >
                  {submittingId === a.id ? 'Submitting…' : 'Mark as done'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
