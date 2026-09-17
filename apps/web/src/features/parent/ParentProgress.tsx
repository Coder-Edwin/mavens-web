import { Panel, Chip } from '@/components/ui/Primitives';
import { MyEnrollmentsPanel } from '@/components/MyEnrollmentsPanel';
import { LEVEL_LABEL } from '@/lib/enrollments';
import { ChildTabs } from '@/features/parent/ChildTabs';
import { useChildren } from '@/features/parent/useChildren';
import { mutedNote } from '@/features/admin/crmStyles';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/// The parent "Progress" nav item's own destination — level/rating at a
/// glance per child, plus the full enrollment detail already shown on
/// Overview. This is genuinely new: no page showed level/rating before.
export function ParentProgress() {
  const { children, activeChildId, setActiveChildId, error } = useChildren();
  const activeChild = children?.find((c) => c.id === activeChildId) ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Progress</div>
          <div className="page-sub">Level, rating and enrollment status</div>
        </div>
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {!children ? (
        <div style={mutedNote}>Loading…</div>
      ) : children.length === 0 ? (
        <Panel title="No children linked yet">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
            No students are linked to your account yet. Ask the club admin to link your child's profile to your
            parent account.
          </p>
        </Panel>
      ) : (
        <>
          <ChildTabs children={children} activeChildId={activeChildId} onSelect={setActiveChildId} />

          {activeChild && (
            <div style={{ margin: '16px 0' }}>
              <Panel title={`${activeChild.firstName}'s progress`}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--muted)', marginBottom: 6 }}>
                      LEVEL
                    </div>
                    {activeChild.level ? (
                      <Chip status="paid" label={LEVEL_LABEL[activeChild.level]} />
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>Not yet placed</span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--muted)', marginBottom: 6 }}>
                      RATING
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{activeChild.currentRating ?? '—'}</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--muted)', marginBottom: 6 }}>
                      MEMBER SINCE
                    </div>
                    <span style={{ fontSize: 13 }}>{formatDate(activeChild.joinedAt)}</span>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          <MyEnrollmentsPanel showStudentName title="Enrollment detail" />
        </>
      )}
    </>
  );
}
