import { Link } from 'react-router-dom';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import '@/styles/marketing.css';

/**
 * Placeholder for the "Join the club" flow. The real interest-registration
 * form (name, contact, child details → leads inbox for the admin) ships as
 * its own feature. For now this route just exists so the landing-page CTAs
 * have somewhere to land.
 */
export function JoinPage() {
  return (
    <div className="mk">
      <MarketingHeader />

      <section className="mk-subpage">
        <div className="mk-container">
          <p className="mk-eyebrow">Join the club</p>
          <h2 className="mk-h2">Registration is opening soon</h2>
          <p className="mk-lead" style={{ margin: '12px auto 0' }}>
            We're building an online form where interested families can share their details and a coach
            will get back to them. In the meantime, reach us directly:
          </p>
          <ul
            style={{
              listStyle: 'none',
              marginTop: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--muted)'
            }}
          >
            <li>+254 702 101 676</li>
            <li>
              <a href="mailto:info@mavens.co.ke">info@mavens.co.ke</a>
            </li>
            <li>A108 Westlands Road, Nairobi</li>
          </ul>
          <div style={{ marginTop: 28 }}>
            <Link to="/" className="btn btn-ghost btn-sm">
              ← Back to site
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
