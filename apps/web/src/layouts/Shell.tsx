import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { AuthUser } from '@/lib/auth-context';

type EffectiveRole = 'admin' | 'coach' | 'student' | 'parent';

// `to` marks a nav item that's actually wired to a route; the rest are still
// placeholders from the original single-page dashboard.
const NAV_ITEMS: Record<EffectiveRole, { glyph: string; label: string; to?: string }[]> = {
  admin: [
    { glyph: '♔', label: 'Overview', to: '/app' },
    { glyph: '♞', label: 'Coaches' },
    { glyph: '♟', label: 'Students' },
    { glyph: '♜', label: 'Tournaments' },
    { glyph: '♛', label: 'Payments' },
    { glyph: '♝', label: 'Merchandise' },
    { glyph: '♙', label: 'Articles', to: '/app/articles' },
    { glyph: '♟', label: 'Leads', to: '/app/leads' },
    { glyph: '♗', label: 'Announcements', to: '/app/announcements' },
    { glyph: '♞', label: 'Play', to: '/app/play' },
    { glyph: '♖', label: 'Reports' }
  ],
  coach: [
    { glyph: '♟', label: 'My Students', to: '/app' },
    { glyph: '♔', label: "Today's Sessions" },
    { glyph: '♗', label: 'Lesson Plans' },
    { glyph: '♘', label: 'Puzzles' },
    { glyph: '♜', label: 'Recording Sheets' },
    { glyph: '♞', label: 'Play', to: '/app/play' }
  ],
  student: [
    { glyph: '♔', label: 'My Progress', to: '/app' },
    { glyph: '♘', label: 'Puzzles' },
    { glyph: '♗', label: 'Lessons' },
    { glyph: '♜', label: 'Tournaments' },
    { glyph: '♕', label: 'Badges' },
    { glyph: '♞', label: 'Play', to: '/app/play' }
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
  const { pathname } = useLocation();
  // "/app" is only active on an exact match; deeper routes ("/app/articles")
  // match by prefix.
  const isActive = (to: string) => (to === '/app' ? pathname === '/app' : pathname.startsWith(to));

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
            {NAV_ITEMS[effectiveRole].map((item, i) => {
              // Routed items light up by path. Roles whose nav isn't wired to
              // routes yet keep the original "first item active" behaviour.
              const anyRouted = NAV_ITEMS[effectiveRole].some((n) => n.to);
              const active = item.to ? isActive(item.to) : !anyRouted && i === 0;
              const inner = (
                <>
                  <span className="glyph">{item.glyph}</span>
                  {item.label}
                </>
              );
              return item.to ? (
                <Link key={item.label} to={item.to} className={`nav-item ${active ? 'active' : ''}`}>
                  {inner}
                </Link>
              ) : (
                <div key={item.label} className={`nav-item ${active ? 'active' : ''}`}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>

        <div className="main">{children}</div>
      </div>
    </>
  );
}
