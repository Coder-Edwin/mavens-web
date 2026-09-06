import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/Primitives";
import { AnnouncementsPanel } from "@/components/AnnouncementsPanel";
import { api, ApiError } from "@/lib/api-client";

interface StudentSummary {
  id: string;
  firstName: string;
  lastName: string;
}

interface SessionAttendanceRecord {
  studentId: string;
  present: boolean;
}

interface SessionRecord {
  id: string;
  topic: string;
  date: string;
  attendance: SessionAttendanceRecord[];
}

interface GradingAssignment {
  id: string;
  status: "NEW" | "SUBMITTED" | "GRADED";
  puzzleSet: { title: string };
  student: { firstName: string; lastName: string };
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 7,
  border: "1px solid var(--line)",
  background: "var(--panel-alt)",
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 12.5,
};

function lastSessionDate(
  studentId: string,
  sessions: SessionRecord[],
): string | null {
  const dates = sessions
    .filter((s) =>
      s.attendance.some((a) => a.studentId === studentId && a.present),
    )
    .map((s) => s.date)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return dates[0] ?? null;
}

export function CoachDashboard() {
  const [roster, setRoster] = useState<StudentSummary[] | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);
  const [gradingQueue, setGradingQueue] = useState<GradingAssignment[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const [logTopic, setLogTopic] = useState("");
  const [logSelectedIds, setLogSelectedIds] = useState<string[]>([]);
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logSuccess, setLogSuccess] = useState<string | null>(null);

  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [gradeSubmitting, setGradeSubmitting] = useState(false);

  async function loadAll() {
    try {
      // scope=own matters specifically for a coach-admin like Amwai — it's
      // what makes this dashboard show HIS students/sessions/assignments
      // rather than the whole club's, even though his JWT role is ADMIN.
      const [studentsData, sessionsData, assignmentsData] = await Promise.all([
        api.get<StudentSummary[]>("/students?scope=own"),
        api.get<SessionRecord[]>("/sessions?scope=own"),
        api.get<GradingAssignment[]>("/puzzle-assignments?scope=own"),
      ]);
      setRoster(studentsData);
      setSessions(sessionsData);
      setGradingQueue(assignmentsData.filter((a) => a.status === "SUBMITTED"));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load your dashboard.",
      );
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleLogStudent(id: string) {
    setLogSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleLogSession() {
    if (!logTopic.trim() || logSelectedIds.length === 0) return;
    setLogSubmitting(true);
    setLogSuccess(null);
    try {
      await api.post("/sessions", {
        topic: logTopic,
        date: new Date().toISOString().slice(0, 10),
        presentStudentIds: logSelectedIds,
      });
      setLogTopic("");
      setLogSelectedIds([]);
      setLogSuccess("Session logged.");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not log this session.",
      );
    } finally {
      setLogSubmitting(false);
    }
  }

  async function handleGrade(assignmentId: string) {
    const score = Number(gradeScore);
    if (Number.isNaN(score) || score < 0 || score > 100) return;
    setGradeSubmitting(true);
    try {
      await api.patch(`/puzzle-assignments/${assignmentId}/grade`, {
        score,
        feedback: gradeFeedback || undefined,
      });
      setGradingId(null);
      setGradeScore("");
      setGradeFeedback("");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not grade this submission.",
      );
    } finally {
      setGradeSubmitting(false);
    }
  }

  if (error) {
    return (
      <div className="panel" style={{ borderColor: "var(--red)" }}>
        <div className="panel-title">Something went wrong</div>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--muted)",
            marginTop: 8,
          }}
        >
          {error}
        </p>
      </div>
    );
  }

  if (!roster || !sessions || !gradingQueue) {
    return <div className="page-sub">Loading your dashboard…</div>;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">My Students</div>
          <div className="page-sub">
            {roster.length} STUDENT{roster.length === 1 ? "" : "S"} ASSIGNED TO
            YOU
          </div>
        </div>
      </div>

      <AnnouncementsPanel />

      <div className="grid-2">
        <Panel title="Log a Session">
          <input
            type="text"
            placeholder="What did you cover? e.g. Rook endgames"
            value={logTopic}
            onChange={(e) => setLogTopic(e.target.value)}
            style={{ ...fieldStyle, marginBottom: 12 }}
          />
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--muted)",
              marginBottom: 8,
            }}
          >
            WHO ATTENDED?
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 14,
            }}
          >
            {roster.length === 0 && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--muted)",
                }}
              >
                No students are assigned to you yet.
              </div>
            )}
            {roster.map((s) => (
              <label
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={logSelectedIds.includes(s.id)}
                  onChange={() => toggleLogStudent(s.id)}
                />
                {s.firstName} {s.lastName}
              </label>
            ))}
          </div>
          <button
            className="btn btn-gold"
            disabled={
              logSubmitting || !logTopic.trim() || logSelectedIds.length === 0
            }
            onClick={handleLogSession}
          >
            {logSubmitting ? "Logging…" : "Log Session"}
          </button>
          {logSuccess && (
            <div
              style={{
                marginTop: 10,
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--leaf)",
              }}
            >
              {logSuccess}
            </div>
          )}
        </Panel>

        <Panel title="Needs Grading">
          {gradingQueue.length === 0 && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--muted)",
              }}
            >
              Nothing waiting on you right now.
            </div>
          )}
          {gradingQueue.map((a) => (
            <div
              key={a.id}
              style={{
                paddingBottom: 14,
                marginBottom: 14,
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div style={{ fontSize: 13 }}>
                <b>
                  {a.student.firstName} {a.student.lastName}
                </b>{" "}
                — {a.puzzleSet.title}
              </div>
              {gradingId === a.id ? (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="Score (0–100)"
                    value={gradeScore}
                    onChange={(e) => setGradeScore(e.target.value)}
                    style={fieldStyle}
                  />
                  <input
                    type="text"
                    placeholder="Feedback (optional)"
                    value={gradeFeedback}
                    onChange={(e) => setGradeFeedback(e.target.value)}
                    style={fieldStyle}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-gold btn-sm"
                      disabled={gradeSubmitting}
                      onClick={() => handleGrade(a.id)}
                    >
                      {gradeSubmitting ? "Saving…" : "Submit Grade"}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setGradingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setGradingId(a.id);
                    setGradeScore("");
                    setGradeFeedback("");
                  }}
                >
                  Grade
                </button>
              )}
            </div>
          ))}
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title="Roster">
          {roster.length === 0 ? (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--muted)",
              }}
            >
              No students are assigned to you yet.
            </div>
          ) : (
            roster.map((s) => {
              const last = lastSessionDate(s.id, sessions);
              return (
                <div className="student-row" key={s.id}>
                  <div className="student-avatar">
                    {s.firstName[0]}
                    {s.lastName[0]}
                  </div>
                  <div className="student-info">
                    <div className="student-name">
                      {s.firstName} {s.lastName}
                    </div>
                    <div className="student-detail">
                      {last
                        ? `Last session: ${new Date(last).toLocaleDateString()}`
                        : "No sessions logged yet"}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </Panel>
      </div>
    </>
  );
}
