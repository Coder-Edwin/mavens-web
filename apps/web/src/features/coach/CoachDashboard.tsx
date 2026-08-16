import { Panel, FeedItem, Button, ProgressBar } from '@/components/ui/Primitives';
import { todaysSessions, gradingQueue, roster } from '@/data/mockData';

export function CoachDashboard() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">My Students</div>
          <div className="page-sub">COACH WANJIKU &nbsp;·&nbsp; GROUP B &amp; PRIVATE STUDENTS</div>
        </div>
        <Button>+ Log Session</Button>
      </div>

      <div className="grid-2">
        <Panel title="Today's Sessions">
          {todaysSessions.map((s) => (
            <div className="session-item" key={s.id}>
              <div className="session-meta">
                <span className="time">{s.time}</span>
                {s.label}
              </div>
              <Button variant="ghost" size="sm">
                Log
              </Button>
            </div>
          ))}
        </Panel>

        <Panel title="Needs Grading">
          {gradingQueue.map((g) => (
            <FeedItem key={g.id} text={g.text} />
          ))}
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title="Roster">
          {roster.map((student) => (
            <div className="student-row" key={student.id}>
              <div className="student-avatar">{student.initials}</div>
              <div className="student-info">
                <div className="student-name">{student.name}</div>
                <div className="student-detail">
                  Last session: {student.lastSession} · {student.puzzlesThisMonth} puzzles solved this month
                </div>
                <ProgressBar percent={student.progressPercent} />
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
}
