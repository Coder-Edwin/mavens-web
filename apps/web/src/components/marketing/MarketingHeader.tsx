import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Shared public-site header. On the landing page (`variant="home"`) the
 * section links are in-page anchors; on sub-pages they point back to the
 * landing page's anchors. "Articles" is always a real route.
 */
export function MarketingHeader({ variant = 'sub' }: { variant?: 'home' | 'sub' }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const anchor = (id: string) => (variant === 'home' ? `#${id}` : `/#${id}`);

  const links = [
    { label: 'About', href: anchor('about') },
    { label: 'Programs', href: anchor('programs') },
    { label: 'Coaches', href: anchor('coaches') },
    { label: 'Donate', href: anchor('donors') },
    { label: 'Articles', href: '/articles', route: true },
    { label: 'Contact', href: anchor('contact') }
  ];

  return (
    <header className={`mk-nav${menuOpen ? ' open' : ''}`}>
      <div className="mk-container mk-nav-inner">
        <Link to="/" className="brand" aria-label="Mavens Chess Club home">
          <span className="brand-mark">♞</span>
          <span>
            <span className="brand-name" style={{ display: 'block' }}>
              Mavens Chess Club
            </span>
            <span className="brand-sub">Learn · Grow · Play</span>
          </span>
        </Link>

        <nav className="mk-nav-links" aria-label="Primary">
          {links.map((l) =>
            l.route ? (
              <Link key={l.label} to={l.href} onClick={() => setMenuOpen(false)}>
                {l.label}
              </Link>
            ) : (
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)}>
                {l.label}
              </a>
            )
          )}
        </nav>

        <div className="mk-nav-actions">
          <Link to="/login" className="btn btn-ghost btn-sm">
            Sign in
          </Link>
          <Link to="/join" className="btn btn-gold btn-sm">
            Join the club
          </Link>
          <button
            className="mk-nav-toggle"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            ☰
          </button>
        </div>
      </div>
    </header>
  );
}
