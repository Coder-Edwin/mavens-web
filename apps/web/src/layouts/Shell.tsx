import type { ReactNode } from 'react';
import type { AuthUser } from '@/lib/auth-context';

type EffectiveRole = 'admin' | 'coach' | 'student' | 'parent';

const NAV_ITEMS: Record<EffectiveRole, { glyph: string; label: string }[]> = {
  admin: [
    { glyph: '♔', label: 'Overview' },
    { glyph: '♞', label: 'Coaches' },
    { glyph: '♟', label: 'Students' },
    { glyph: '♜', label: 'Tournaments' },
    { glyph: '♛', label: 'Payments' },
    { glyph: '♝', label: 'Merchandise' },
    { glyph: '♖', label: 'Reports' }
  ],
  coach: [
    { glyph: '♟', label: 'My Students' },
    { glyph: '♔', label: "Today's Sessions" },
    { glyph: '♗', label: 'Lesson Plans' },
    { glyph: '♘', label: 'Puzzles' },
    { glyph: '♜', label: 'Recording Sheets' }
  ],
  student: [
    { glyph: '♔', label: 'My Progress' },
    { glyph: '♘', label: 'Puzzles' },
    { glyph: '♗', label: 'Lessons' },
    { glyph: '♜', label: 'Tournaments' },
    { glyph: '♕', label: 'Badges' }
  ],
  parent: [
    { glyph: '♔', label: 'Overview' },
    { glyph: '♛', label: 'Payments' },
    { glyph: '♟', label: 'Progress' },
    { glyph: '♜', label: 'Tournaments' },
    { glyph: '♝', label: 'Store' }
  ]
};

const NAV_GROUP_LABEL: Record<EffectiveRole, string> = {
  admin: 'Club',
  coach: 'Teaching',
  student: 'My Chess',
  parent: 'Family'
};

interface ShellProps {
  user: AuthUser;
  viewAsCoach: boolean;
  onToggleCoachView: () => void;
  onLogout: () => void;
  children: ReactNode;
}

export function Shell({ user, viewAsCoach, onToggleCoachView, onLogout, children }: ShellProps) {
  const effectiveRole: EffectiveRole =
    user.role === 'ADMIN' && user.isCoach && viewAsCoach ? 'coach' : (user.role.toLowerCase() as EffectiveRole);

  const showCoachToggle = user.role === 'ADMIN' && user.isCoach;

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">♞</div>
          <div>
            <div className="brand-name">Mavens Chess Club</div>
            <div className="brand-sub">Academy Management</div>
          </div>
        </div>

        {showCoachToggle && (
          <div className="role-switch">
            <button className={!viewAsCoach ? 'active' : ''} onClick={() => viewAsCoach && onToggleCoachView()}>
              Admin
            </button>
            <button className={viewAsCoach ? 'active' : ''} onClick={() => !viewAsCoach && onToggleCoachView()}>
              Coach
            </button>
          </div>
        )}

        <div className="topbar-right">
          <div className="preview-tag" style={{ borderStyle: 'solid' }}>
            {user.email}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>

      <div className="layout">
        <div className="sidebar">
          <div className="coord-row">
            {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
          <div className="nav-group">
            <div className="nav-label">{NAV_GROUP_LABEL[effectiveRole]}</div>
            {NAV_ITEMS[effectiveRole].map((item, i) => (
              <div key={item.label} className={`nav-item ${i === 0 ? 'active' : ''}`}>
                <span className="glyph">{item.glyph}</span>
                {item.label}
              </div>
            ))}
          </div>
        </div>

        <div className="main">{children}</div>
      </div>
    </>
  );
}
