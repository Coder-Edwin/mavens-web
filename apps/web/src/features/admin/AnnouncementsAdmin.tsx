import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  announcementsApi,
  formatAnnouncementDate,
  AUDIENCES,
  AUDIENCE_LABEL,
  type AdminAnnouncement,
  type Audience
} from '@/lib/announcements';

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 6,
  marginBottom: 14,
  padding: '9px 11px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--panel-alt)',
  color: 'var(--text)',
  fontFamily: 'var(--font-body)',
  fontSize: 13
};
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--muted)',
  letterSpacing: '0.04em'
};

export function AnnouncementsAdmin() {
  const [items, setItems] = useState<AdminAnnouncement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('ALL');
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      setItems(await announcementsApi.listAdmin());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load announcements.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await announcementsApi.create({ title: title.trim(), body: body.trim(), audience });
      setTitle('');
      setBody('');
      setAudience('ALL');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the announcement.');
    } finally {
      setSending(false);
    }
  }

  async function remove(a: AdminAnnouncement) {
    if (!window.confirm(`Delete “${a.title}”? Recipients will no longer see it.`)) return;
    setBusyId(a.id);
    setError(null);
    try {
      await announcementsApi.remove(a.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the announcement.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Announcements</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <Panel title="New announcement">
          <form onSubmit={handleSend} aria-label="New announcement">
            <label style={labelStyle} htmlFor="ann-title">
              Title
            </label>
            <input
              id="ann-title"
              style={inputStyle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              required
            />

            <label style={labelStyle} htmlFor="ann-body">
              Message
            </label>
            <textarea
              id="ann-body"
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
              required
            />

            <label style={labelStyle} htmlFor="ann-audience">
              Send to
            </label>
            <select
              id="ann-audience"
              style={inputStyle}
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
            >
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_LABEL[a]}
                </option>
              ))}
            </select>

            <button type="submit" className="btn btn-gold" disabled={sending}>
              {sending ? 'Sending…' : 'Send announcement'}
            </button>
          </form>
        </Panel>
      </div>

      <Panel title="Sent">
        {!items && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>Loading…</div>
        )}
        {items && items.length === 0 && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
            Nothing broadcast yet.
          </div>
        )}
        {items && items.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Audience</th>
                <th>Sent</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.title}</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--muted)',
                        marginTop: 3,
                        maxWidth: 420,
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {a.body}
                    </div>
                  </td>
                  <td>
                    <span className="chip pending">{AUDIENCE_LABEL[a.audience]}</span>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {formatAnnouncementDate(a.createdAt)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => remove(a)}
                      disabled={busyId === a.id}
                      style={{ color: 'var(--red)' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
