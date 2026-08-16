import type { ReactNode } from 'react';
import type { Role } from '@/types';

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Amwai (Admin)',
  coach: 'Coach Wanjiku',
  student: 'Faith Wambui (Student)',
  parent: 'Mrs. Kimani (Parent)'
};

const NAV_ITEMS: Record<Role, { glyph: string; label: string }[]> = {
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

const NAV_GROUP_LABEL: Record<Role, string> = {
  admin: 'Club',
  coach: 'Teaching',
  student: 'My Chess',
  parent: 'Family'
};

interface ShellProps {
  role: Role;
  onRoleChange: (role: Role) => void;
  children: ReactNode;
}

export function Shell({ role, onRoleChange, children }: ShellProps) {
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

        <div className="role-switch">
          {(Object.keys(NAV_ITEMS) as Role[]).map((r) => (
            <button key={r} className={r === role ? 'active' : ''} onClick={() => onRoleChange(r)}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        <div className="topbar-right">
          <div className="preview-tag">Previewing as {ROLE_LABELS[role]}</div>
          <div className="avatar">
            {ROLE_LABELS[role]
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')}
          </div>
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
            <div className="nav-label">{NAV_GROUP_LABEL[role]}</div>
            {NAV_ITEMS[role].map((item, i) => (
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
