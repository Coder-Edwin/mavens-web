import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { AuthUser } from '@/lib/auth-context';
import { BrandMark } from '@/components/BrandMark';

type EffectiveRole = 'admin' | 'coach' | 'student' | 'parent';

// `to` marks a nav item that's actually wired to a route; the rest are still
// placeholders from the original single-page dashboard.
const NAV_ITEMS: Record<EffectiveRole, { glyph: string; label: string; to?: string }[]> = {
  admin: [
    { glyph: '♔', label: 'Overview', to: '/app' },
    { glyph: '♞', label: 'Coaches', to: '/app/coaches' },
    { glyph: '♟', label: 'Students', to: '/app/students' },
    { glyph: '♗', label: 'Lesson Plans', to: '/app/lesson-plans' },
    { glyph: '♜', label: 'Recording Sheets', to: '/app/recording-sheets' },
    { glyph: '♘', label: 'Puzzles', to: '/app/puzzles' },
    { glyph: '♕', label: 'Badges', to: '/app/badges' },
    { glyph: '♜', label: 'Tournaments', to: '/app/tournaments' },
    { glyph: '♘', label: 'Enrollments', to: '/app/enrollments' },
    { glyph: '♗', label: 'Placement queue', to: '/app/placements' },
    { glyph: '♜', label: 'Partner schools', to: '/app/school-groups' },
    { glyph: '♟', label: 'This week', to: '/app/schedule' },
    { glyph: '♚', label: 'Class schedules', to: '/app/class-schedules' },
    { glyph: '♔', label: 'Terms', to: '/app/terms' },
    { glyph: '♛', label: 'Invoices', to: '/app/invoices' },
    { glyph: '♜', label: 'Rate cards', to: '/app/rate-cards' },
    { glyph: '♞', label: 'Coach payouts', to: '/app/payouts' },
    { glyph: '♝', label: 'Merchandise', to: '/app/merchandise' },
    { glyph: '♙', label: 'Articles', to: '/app/articles' },
    { glyph: '♘', label: 'Courses', to: '/app/courses' },
    { glyph: '♟', label: 'Leads', to: '/app/leads' },
    { glyph: '♗', label: 'Announcements', to: '/app/announcements' },
    { glyph: '♞', label: 'Play', to: '/app/play' },
    { glyph: '♝', label: 'Analysis', to: '/app/analysis' },
    { glyph: '♞', label: 'Lichess TV', to: '/app/lichess' },
    { glyph: '♗', label: 'Classroom', to: '/app/classroom' },
    { glyph: '♖', label: 'Reports', to: '/app/reports' }
  ],
  coach: [
    { glyph: '♟', label: 'My Students', to: '/app' },
    { glyph: '♔', label: "Today's Sessions", to: '/app/today-sessions' },
    { glyph: '♗', label: 'Lesson Plans', to: '/app/lesson-plans' },
    { glyph: '♘', label: 'Puzzles', to: '/app/puzzles' },
    { glyph: '♕', label: 'Badges', to: '/app/badges' },
    { glyph: '♜', label: 'Recording Sheets', to: '/app/recording-sheets' },
    { glyph: '♞', label: 'Play', to: '/app/play' },
    { glyph: '♝', label: 'Analysis', to: '/app/analysis' },
    { glyph: '♞', label: 'Lichess TV', to: '/app/lichess' },
    { glyph: '♗', label: 'Classroom', to: '/app/classroom' }
  ],
  student: [
    { glyph: '♔', label: 'My Progress', to: '/app' },
    { glyph: '♘', label: 'Puzzles', to: '/app/puzzles' },
    { glyph: '♗', label: 'My Courses', to: '/app/learn' },
    { glyph: '♜', label: 'Tournaments', to: '/app/tournaments' },
    { glyph: '♕', label: 'Badges', to: '/app/badges' },
    { glyph: '♞', label: 'Play', to: '/app/play' },
    { glyph: '♝', label: 'Analysis', to: '/app/analysis' },
    { glyph: '♞', label: 'Lichess TV', to: '/app/lichess' },
    { glyph: '♗', label: 'Classroom', to: '/app/classroom' }
  ],
  parent: [
    { glyph: '♔', label: 'Overview', to: '/app' },
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
          <BrandMark />
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
