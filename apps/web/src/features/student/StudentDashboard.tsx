import { Panel } from '@/components/ui/Primitives';
import { puzzles, puzzlesSolvedByMonth, badges } from '@/data/mockData';
import type { PuzzleStatus } from '@/types';

const STATUS_LABEL: Record<PuzzleStatus, string> = {
  new: 'NEW',
  review: 'SUBMITTED',
  graded: 'GRADED · 9/10'
};

export function StudentDashboard() {
  const maxSolved = Math.max(...puzzlesSolvedByMonth.map((m) => m.value));

  return (
    <>
      <div className="streak-banner">
        <div>
          <h2>Karibu, Faith 👋</h2>
          <p>YOU'VE SOLVED PUZZLES 6 DAYS IN A ROW</p>
        </div>
        <div className="streak-num">
          6<span>DAY STREAK</span>
        </div>
      </div>

      <div className="page-head">
        <div className="page-title" style={{ fontSize: 19 }}>
          Assigned Puzzles
        </div>
      </div>
      <div className="grid-3">
        {puzzles.map((p) => (
          <div className="puzzle-card" key={p.id}>
            <span className={`status-pill ${p.status}`}>{STATUS_LABEL[p.status]}</span>
            <div className="puzzle-board" />
            <div className="puzzle-title">{p.title}</div>
            <div className="puzzle-tag">{p.tag}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <Panel title="Puzzles Solved — Last 6 Months">
          <div className="chart">
            {puzzlesSolvedByMonth.map((m) => (
              <div className="bar-col" key={m.label}>
                <div className="bar" style={{ height: `${(m.value / maxSolved) * 100}%` }} />
                <div className="bar-label">{m.label.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Badges">
          <div className="badge-row">
            {badges.map((b) => (
              <div className="badge" key={b.id}>
                <div className="badge-icon">{b.icon}</div>
                <div className="badge-name">{b.name.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
