import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Panel, ProgressBar } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import { coursesApi, type MyCourseDetail } from '@/lib/courses';

export function CoursePlayerPage() {
  const { courseId = '' } = useParams();
  const [data, setData] = useState<MyCourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(keepActive = false) {
    try {
      const d = await coursesApi.myCourse(courseId);
      setData(d);
      setError(null);
      if (!keepActive) {
        const firstLesson = d.course.modules?.flatMap((m) => m.lessons)[0];
        setActiveLessonId((prev) => prev ?? firstLesson?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this course.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const lessons = useMemo(
    () => data?.course.modules?.flatMap((m) => m.lessons) ?? [],
    [data]
  );
  const done = useMemo(() => new Set(data?.completedLessonIds ?? []), [data]);
  const active = lessons.find((l) => l.id === activeLessonId) ?? null;
  const pct = lessons.length ? Math.round((done.size / lessons.length) * 100) : 0;

  async function toggle(lessonId: string, complete: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (complete) await coursesApi.completeLesson(lessonId);
      else await coursesApi.uncompleteLesson(lessonId);
      await load(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update progress.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <div className="panel" style={{ borderColor: 'var(--red)' }}>
        <div className="panel-title">Something went wrong</div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>{error}</p>
        <Link to="/app/learn" style={{ color: 'var(--gold-soft)' }}>
          ← My courses
        </Link>
      </div>
    );
  }
  if (!data) return <div className="page-sub">Loading course…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{data.course.title}</div>
          <div className="page-sub">
            <Link to="/app/learn" style={{ color: 'var(--gold-soft)' }}>
              ← My courses
            </Link>{' '}
            · {done.size}/{lessons.length} lessons
          </div>
        </div>
        <div style={{ width: 180 }}>
          <ProgressBar percent={pct} />
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Panel title="Lessons">
          {data.course.modules?.map((m) => (
            <div key={m.id} style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--muted)',
                  letterSpacing: '0.04em',
                  marginBottom: 4
                }}
              >
                {m.title}
              </div>
              {m.lessons.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setActiveLessonId(l.id)}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    width: '100%',
                    textAlign: 'left',
                    background: l.id === activeLessonId ? 'var(--panel-alt)' : 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    padding: '7px 8px',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  <span aria-hidden style={{ color: done.has(l.id) ? 'var(--leaf, #6b7f63)' : 'var(--muted)' }}>
                    {done.has(l.id) ? '●' : '○'}
                  </span>
                  {l.title}
                </button>
              ))}
            </div>
          ))}
        </Panel>

        {active && (
          <Panel title={active.title}>
            {active.fen && (
              <div style={{ maxWidth: 320, margin: '0 auto 14px' }}>
                <Chessboard
                  position={active.fen}
                  arePiecesDraggable={false}
                  boardWidth={320}
                  showBoardNotation
                  customBoardStyle={{ borderRadius: 8 }}
                  customDarkSquareStyle={{ backgroundColor: '#6b7f63' }}
                  customLightSquareStyle={{ backgroundColor: '#e9e6d8' }}
                />
              </div>
            )}
            {active.videoUrl && (
              <div style={{ marginBottom: 12 }}>
                <a href={active.videoUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                  Watch the video
                </a>
              </div>
            )}
            {active.body.split(/\n{2,}/).map((para, i) => (
              <p key={i} style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 10, whiteSpace: 'pre-wrap' }}>
                {para}
              </p>
            ))}
            <div style={{ marginTop: 12 }}>
              {done.has(active.id) ? (
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => toggle(active.id, false)}
                >
                  Mark not done
                </button>
              ) : (
                <button
                  className="btn btn-gold btn-sm"
                  disabled={busy}
                  onClick={() => toggle(active.id, true)}
                >
                  Mark complete
                </button>
              )}
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
