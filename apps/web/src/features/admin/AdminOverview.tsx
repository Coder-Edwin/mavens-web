import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KpiCard, Panel, Chip } from '@/components/ui/Primitives';
import { api, ApiError } from '@/lib/api-client';

interface StudentSummary {
  id: string;
}

interface SessionRecord {
  id: string;
  topic: string;
  date: string;
  coach: { id: string; user: { email: string } };
}

interface MerchandiseItemSummary {
  id: string;
  name: string;
  stockQuantity: number;
}

interface PaymentRecord {
  id: string;
  type: 'SUBSCRIPTION' | 'TOURNAMENT' | 'MERCHANDISE';
  status: 'PENDING' | 'PAID' | 'FAILED';
  amount: string;
  createdAt: string;
  student: { firstName: string; lastName: string } | null;
}

const LOW_STOCK_THRESHOLD = 2;

// Payment.status doesn't map 1:1 to the chip classes tokens.css already
// defines (paid / overdue / pending) — FAILED reuses the "overdue" (red)
// treatment since it's visually the same "needs attention" state.
function paymentChip(status: PaymentRecord['status']): { cls: 'paid' | 'overdue' | 'pending'; label: string } {
  if (status === 'PAID') return { cls: 'paid', label: 'Paid' };
  if (status === 'FAILED') return { cls: 'overdue', label: 'Failed' };
  return { cls: 'pending', label: 'Pending' };
}

function formatKes(amount: string): string {
  return `KES ${Number(amount).toLocaleString()}`;
}

export function AdminOverview() {
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);
  const [merchandise, setMerchandise] = useState<MerchandiseItemSummary[] | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [studentsData, sessionsData, merchandiseData, paymentsData] = await Promise.all([
          api.get<StudentSummary[]>('/students'),
          api.get<SessionRecord[]>('/sessions'),
          api.get<MerchandiseItemSummary[]>('/merchandise'),
          api.get<PaymentRecord[]>('/payments')
        ]);
        setStudents(studentsData);
        setSessions(sessionsData);
        setMerchandise(merchandiseData);
        setPayments(paymentsData);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load the admin dashboard.');
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <div className="panel" style={{ borderColor: 'var(--red)' }}>
        <div className="panel-title">Something went wrong</div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{error}</p>
      </div>
    );
  }

  if (!students || !sessions || !merchandise || !payments) {
    return <div className="page-sub">Loading club overview…</div>;
  }

  const activeCoachCount = new Set(sessions.map((s) => s.coach.id)).size;
  const lowStockItems = merchandise.filter((m) => m.stockQuantity <= LOW_STOCK_THRESHOLD);
  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Club Overview</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/app/leads" className="btn btn-ghost btn-sm">
            Leads
          </Link>
          <Link to="/app/announcements" className="btn btn-ghost btn-sm">
            Announcements
          </Link>
          <Link to="/app/articles" className="btn btn-ghost btn-sm">
            Manage articles
          </Link>
        </div>
      </div>

      <div className="kpi-row">
        <KpiCard label="Active Students" value={String(students.length)} />
        <KpiCard label="Active Coaches" value={String(activeCoachCount)} delta="with sessions logged" tone="neutral" />
        <KpiCard label="Sessions Logged" value={String(sessions.length)} />
        <KpiCard
          label="Low Stock Items"
          value={String(lowStockItems.length)}
          delta={lowStockItems.length > 0 ? 'needs restocking' : undefined}
          tone={lowStockItems.length > 0 ? 'warn' : 'neutral'}
        />
      </div>

      <div className="grid-2">
        <Panel title="Coach Activity">
          {recentSessions.length === 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
              No sessions logged yet.
            </div>
          )}
          {recentSessions.map((s) => (
            <div className="feed-item" key={s.id}>
              <div className="feed-dot" />
              <div>
                <div className="feed-text">
                  <b>{s.coach.user.email}</b> logged a session — {s.topic}
                </div>
                <div className="feed-time">{new Date(s.date).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="Alerts">
          {lowStockItems.length === 0 ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
              Nothing needs attention right now.
            </div>
          ) : (
            lowStockItems.map((item) => (
              <div className="alert-card" key={item.id}>
                <b>Low stock —</b> {item.name}: {item.stockQuantity} left
              </div>
            ))
          )}
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title="Payments">
          {payments.length === 0 ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
              No payment attempts yet.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const chip = paymentChip(p.status);
                  return (
                    <tr key={p.id}>
                      <td>{p.student ? `${p.student.firstName} ${p.student.lastName}` : '—'}</td>
                      <td>{p.type}</td>
                      <td className="mono">{formatKes(p.amount)}</td>
                      <td>
                        <Chip status={chip.cls} label={chip.label} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  );
}
