import { KpiCard, Panel, FeedItem, Chip, Button } from '@/components/ui/Primitives';
import { adminKpis, coachActivity, adminAlerts, paymentRows } from '@/data/mockData';

export function AdminOverview() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Club Overview</div>
          <div className="page-sub">WED 12 AUG 2026 &nbsp;·&nbsp; TERM 3, WEEK 6</div>
        </div>
        <Button>+ New Tournament</Button>
      </div>

      <div className="kpi-row">
        {adminKpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} delta={k.delta} tone={k.deltaTone} />
        ))}
      </div>

      <div className="grid-2">
        <Panel title="Coach Activity" linkLabel="View all">
          {coachActivity.map((item) => (
            <FeedItem key={item.id} text={item.text} time={item.time} />
          ))}
        </Panel>

        <Panel title="Alerts">
          {adminAlerts.map((alert) => (
            <div className="alert-card" key={alert.id}>
              <b>{alert.label} —</b> {alert.detail}
            </div>
          ))}
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title="Subscription Status" linkLabel="Manage payments">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Coach</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.studentName}</td>
                  <td>{row.coachName}</td>
                  <td className="mono">{row.amount}</td>
                  <td>
                    <Chip
                      status={row.status}
                      label={
                        row.status === 'paid' ? 'Paid' : row.status === 'overdue' ? 'Overdue — 8 days' : 'Pending STK'
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
