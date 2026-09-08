import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  tournamentsApi,
  formatTournamentDate,
  type TournamentInput,
  type TournamentSummary
} from '@/lib/tournaments';
import { formatKes } from '@/lib/rate-cards';
import { inputStyle, labelStyle, mutedNote, rowActions } from './crmStyles';

const EMPTY: TournamentInput = { name: '', date: '', venue: '', feeAmount: 0 };

export function TournamentsAdmin() {
  const [rows, setRows] = useState<TournamentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TournamentInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    try {
      setRows(await tournamentsApi.list());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load tournaments.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await tournamentsApi.create({
        name: form.name.trim(),
        date: new Date(form.date).toISOString(),
        venue: form.venue.trim(),
        feeAmount: Number(form.feeAmount),
        capacity: form.capacity || undefined,
        totalRounds: form.totalRounds || undefined,
        registrationDeadline: form.registrationDeadline
          ? new Date(form.registrationDeadline).toISOString()
          : undefined
      });
      setShowForm(false);
      setForm(EMPTY);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the tournament.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Tournaments</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
        {!showForm && <Button onClick={() => setShowForm(true)}>New tournament</Button>}
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <Panel title="New tournament">
            <form onSubmit={handleSubmit}>
              <label style={labelStyle} htmlFor="tn-name">
                Name
              </label>
              <input
                id="tn-name"
                style={inputStyle}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="tn-date">
                    Date
                  </label>
                  <input
                    id="tn-date"
                    type="date"
                    style={inputStyle}
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="tn-venue">
                    Venue
                  </label>
                  <input
                    id="tn-venue"
                    style={inputStyle}
                    value={form.venue}
                    onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="tn-fee">
                    Fee (KES)
                  </label>
                  <input
                    id="tn-fee"
                    type="number"
                    min={0}
                    step="0.01"
                    style={inputStyle}
                    value={form.feeAmount}
                    onChange={(e) => setForm((f) => ({ ...f, feeAmount: Number(e.target.value) }))}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="tn-cap">
                    Capacity <span style={{ opacity: 0.6 }}>— optional</span>
                  </label>
                  <input
                    id="tn-cap"
                    type="number"
                    min={1}
                    style={inputStyle}
                    value={form.capacity ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        capacity: e.target.value ? Number(e.target.value) : undefined
                      }))
                    }
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="tn-rounds">
                    Rounds <span style={{ opacity: 0.6 }}>— optional</span>
                  </label>
                  <input
                    id="tn-rounds"
                    type="number"
                    min={1}
                    style={inputStyle}
                    value={form.totalRounds ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        totalRounds: e.target.value ? Number(e.target.value) : undefined
                      }))
                    }
                  />
                </div>
              </div>

              <label style={labelStyle} htmlFor="tn-deadline">
                Registration deadline <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <input
                id="tn-deadline"
                type="date"
                style={inputStyle}
                value={form.registrationDeadline ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, registrationDeadline: e.target.value || undefined }))
                }
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Creating…' : 'Create tournament'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <Panel title="Tournaments">
        {!rows && <div style={mutedNote}>Loading…</div>}
        {rows && rows.length === 0 && <div style={mutedNote}>No tournaments scheduled.</div>}
        {rows && rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Venue</th>
                <th>Fee</th>
                <th>Players</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/app/tournaments/${t.id}`} style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {t.name}
                    </Link>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {formatTournamentDate(t.date)}
                  </td>
                  <td style={{ fontSize: 13 }}>{t.venue}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {formatKes(t.feeAmount)}
                  </td>
                  <td className="mono">
                    {t.registeredCount}
                    {t.capacity ? `/${t.capacity}` : ''}
                    {t.isFull ? ' · full' : ''}
                  </td>
                  <td style={rowActions}>
                    <Link to={`/app/tournaments/${t.id}`} className="btn btn-ghost btn-sm">
                      Manage
                    </Link>
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
