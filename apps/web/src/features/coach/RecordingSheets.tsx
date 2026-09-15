import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import { recordingSheetsApi, type RecordingSheet } from '@/lib/recording-sheets';
import { studentsApi, studentName, type StudentRecord } from '@/lib/students';
import { inputStyle, labelStyle, mutedNote } from '@/features/admin/crmStyles';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function RecordingSheets() {
  const [roster, setRoster] = useState<StudentRecord[] | null>(null);
  const [studentId, setStudentId] = useState('');
  const [sheets, setSheets] = useState<RecordingSheet[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [imageUrl, setImageUrl] = useState('');
  const [comment, setComment] = useState('');
  const [uploading, setUploading] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    studentsApi
      .list('own')
      .then((rows) => {
        setRoster(rows);
        setStudentId((prev) => prev || rows[0]?.id || '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your roster.'));
  }, []);

  async function refreshSheets(forId: string) {
    if (!forId) return;
    try {
      setSheets(await recordingSheetsApi.listForStudent(forId));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load recording sheets.');
    }
  }

  useEffect(() => {
    setSheets(null);
    refreshSheets(studentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!studentId || !imageUrl.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await recordingSheetsApi.create({
        studentId,
        imageUrl: imageUrl.trim(),
        coachComment: comment.trim() || undefined
      });
      setImageUrl('');
      setComment('');
      await refreshSheets(studentId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload this recording sheet.');
    } finally {
      setUploading(false);
    }
  }

  async function saveComment(id: string) {
    const text = (drafts[id] ?? '').trim();
    if (!text) return;
    setSavingId(id);
    setError(null);
    try {
      await recordingSheetsApi.setComment(id, text);
      await refreshSheets(studentId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this comment.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Recording Sheets</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>{' '}
            · photographed OTB scoresheets, filed per student for review
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {!roster ? (
        <div style={mutedNote}>Loading your roster…</div>
      ) : roster.length === 0 ? (
        <Panel title="No students yet">
          <div style={mutedNote}>You have no students assigned to you yet.</div>
        </Panel>
      ) : (
        <>
          <div style={{ marginBottom: 16, maxWidth: 320 }}>
            <label style={labelStyle} htmlFor="rs-student">
              Student
            </label>
            <select
              id="rs-student"
              style={inputStyle}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              {roster.map((s) => (
                <option key={s.id} value={s.id}>
                  {studentName(s)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <Panel title="Upload a sheet">
              <form onSubmit={upload}>
                <label style={labelStyle} htmlFor="rs-image">
                  Photo URL <span style={{ opacity: 0.6 }}>— paste a link to the already-hosted photo</span>
                </label>
                <input
                  id="rs-image"
                  style={inputStyle}
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…"
                  required
                />
                <label style={labelStyle} htmlFor="rs-comment">
                  Comment <span style={{ opacity: 0.6 }}>— optional, counts as reviewing it</span>
                </label>
                <textarea
                  id="rs-comment"
                  style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <Button type="submit" disabled={uploading || !imageUrl.trim()}>
                  {uploading ? 'Uploading…' : 'Upload'}
                </Button>
              </form>
            </Panel>
          </div>

          <Panel title="Sheets on file">
            {!sheets && <div style={mutedNote}>Loading…</div>}
            {sheets && sheets.length === 0 && <div style={mutedNote}>No recording sheets uploaded yet.</div>}
            {sheets && sheets.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {sheets.map((sheet) => (
                  <div key={sheet.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <a href={sheet.imageUrl} target="_blank" rel="noreferrer">
                        <img
                          src={sheet.imageUrl}
                          alt="Recording sheet"
                          style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }}
                        />
                      </a>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                          Uploaded {formatDate(sheet.uploadedAt)}
                        </div>
                        {sheet.coachComment && (
                          <div style={{ fontSize: 13, marginTop: 6 }}>
                            "{sheet.coachComment}"
                            {sheet.reviewedBy && (
                              <span style={{ color: 'var(--muted)' }}>
                                {' '}
                                — {sheet.reviewedBy.firstName} {sheet.reviewedBy.lastName}
                              </span>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <input
                            style={{ ...inputStyle, margin: 0, flex: 1 }}
                            placeholder={sheet.coachComment ? 'Update comment…' : 'Leave a comment…'}
                            value={drafts[sheet.id] ?? ''}
                            onChange={(e) => setDrafts((d) => ({ ...d, [sheet.id]: e.target.value }))}
                          />
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={savingId === sheet.id || !(drafts[sheet.id] ?? '').trim()}
                            onClick={() => saveComment(sheet.id)}
                          >
                            {savingId === sheet.id ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
