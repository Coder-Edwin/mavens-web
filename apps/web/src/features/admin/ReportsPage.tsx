import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KpiCard, Panel } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import {
  reportsApi,
  sumValues,
  type CoachActivityRow,
  type EnrollmentFunnel,
  type ReportOverview,
  type RevenueRow
} from '@/lib/reports';
import { formatKes } from '@/lib/rate-cards';
import { mutedNote } from './crmStyles';

function Breakdown({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <span style={mutedNote}>—</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="mono"
          style={{
            fontSize: 11,
            background: 'var(--panel-alt)',
            borderRadius: 6,
            padding: '3px 7px'
          }}
        >
          {k.replace(/_/g, ' ').toLowerCase()} <b>{v}</b>
        </span>
      ))}
    </div>
  );
}

export function ReportsPage() {
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [revenue, setRevenue] = useState<RevenueRow[] | null>(null);
  const [coaches, setCoaches] = useState<CoachActivityRow[] | null>(null);
  const [funnel, setFunnel] = useState<EnrollmentFunnel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      reportsApi.overview(),
      reportsApi.revenue(),
      reportsApi.coachActivity(),
      reportsApi.funnel()
    ])
      .then(([o, r, c, f]) => {
        setOverview(o);
        setRevenue(r);
        setCoaches(c);
        setFunnel(f);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load reports.'));
  }, []);

  const revMax = Math.max(1, ...(revenue ?? []).map((r) => r.invoiced));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => reportsApi.exportStudents()}>
            Students CSV
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => reportsApi.exportEnrollments()}>
            Enrollments CSV
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => reportsApi.exportAttendance()}>
            Attendance CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {!overview && <div className="page-sub">Loading reports…</div>}

      {overview && (
        <>
          <div className="kpi-row">
            <KpiCard label="Students" value={String(overview.students.total)} />
            <KpiCard
              label="Active enrollments"
              value={String(overview.enrollments.byStatus.ACTIVE ?? 0)}
            />
            <KpiCard
              label="Outstanding"
              value={formatKes(overview.billing.outstanding)}
              delta={overview.billing.outstanding > 0 ? 'unpaid invoices' : undefined}
              tone={overview.billing.outstanding > 0 ? 'warn' : 'neutral'}
            />
            <KpiCard
              label="Overdue reviews"
              value={String(overview.placements.overdueReviews)}
              delta={overview.placements.overdueReviews > 0 ? 'reassess' : undefined}
              tone={overview.placements.overdueReviews > 0 ? 'warn' : 'neutral'}
            />
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <Panel title="Students by level">
              <Breakdown data={overview.students.byLevel} />
              <div style={{ ...mutedNote, marginTop: 12 }}>Enrollments by status</div>
              <div style={{ marginTop: 4 }}>
                <Breakdown data={overview.enrollments.byStatus} />
              </div>
              <div style={{ ...mutedNote, marginTop: 12 }}>Enrollments by delivery</div>
              <div style={{ marginTop: 4 }}>
                <Breakdown data={overview.enrollments.byDelivery} />
              </div>
            </Panel>

            <Panel title="This month">
              <div style={{ ...mutedNote }}>Sessions</div>
              <div style={{ marginTop: 4 }}>
                <Breakdown data={overview.schedule.sessionsThisMonth} />
              </div>
              <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
                <div>
                  <div style={mutedNote}>Active schedules</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {overview.schedule.activeSchedules}
                  </div>
                </div>
                <div>
                  <div style={mutedNote}>Placements scheduled</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{overview.placements.scheduled}</div>
                </div>
                <div>
                  <div style={mutedNote}>Payments received (all time)</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {formatKes(overview.billing.paymentsReceivedAllTime)}
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <div style={{ marginTop: 16 }}>
            <Panel title="Revenue by month">
              {!revenue || revenue.length === 0 ? (
                <div style={mutedNote}>No invoices in range.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Invoiced</th>
                      <th>Paid</th>
                      <th>Outstanding</th>
                      <th aria-label="bar" />
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.map((r) => (
                      <tr key={r.month}>
                        <td className="mono">{r.month}</td>
                        <td className="mono">{formatKes(r.invoiced)}</td>
                        <td className="mono">{formatKes(r.paid)}</td>
                        <td className="mono">{formatKes(r.outstanding)}</td>
                        <td style={{ width: 160 }}>
                          <div
                            style={{
                              height: 8,
                              borderRadius: 4,
                              background: 'var(--gold-soft)',
                              width: `${Math.round((r.invoiced / revMax) * 100)}%`,
                              minWidth: r.invoiced > 0 ? 4 : 0
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          <div className="grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
            <Panel title="Coach activity (this month)">
              {!coaches || coaches.length === 0 ? (
                <div style={mutedNote}>No completed sessions this month.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Coach</th>
                      <th>Sessions</th>
                      <th>Students</th>
                      <th>Payout due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coaches.map((c) => (
                      <tr key={c.coachId}>
                        <td style={{ fontSize: 13 }}>{c.name}</td>
                        <td className="mono">{c.sessions}</td>
                        <td className="mono">{c.studentsTaught}</td>
                        <td className="mono" style={{ fontSize: 12 }}>
                          {formatKes(c.payoutDue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            {funnel && (
              <Panel title="Enrollment funnel">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <FunnelStep
                    label="Leads"
                    value={funnel.leads.total}
                    sub={`${funnel.leads.converted} converted`}
                  />
                  <FunnelStep
                    label="Placements"
                    value={funnel.placements.scheduled + funnel.placements.completed}
                    sub={`${funnel.placements.scheduled} scheduled · ${funnel.placements.completed} done`}
                  />
                  <FunnelStep
                    label="Enrollments"
                    value={funnel.enrollments.total}
                    sub={`${funnel.enrollments.active} active`}
                  />
                  <div style={{ ...mutedNote, marginTop: 4 }}>
                    Leads by status
                    <div style={{ marginTop: 4 }}>
                      <Breakdown data={funnel.leads.byStatus} />
                    </div>
                  </div>
                  <div style={mutedNote}>Total lead pipeline: {sumValues(funnel.leads.byStatus)}</div>
                </div>
              </Panel>
            )}
          </div>
        </>
      )}
    </>
  );
}

function FunnelStep({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <div style={{ width: 96, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={mutedNote}>{sub}</div>
    </div>
  );
}
