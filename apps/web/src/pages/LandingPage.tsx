import { useState } from 'react';
import { Link } from 'react-router-dom';
import '@/styles/marketing.css';

/**
 * Public marketing landing page. Section order mirrors a conventional
 * chess-club site: hero → about → programs → founder → coaches →
 * donors/partners → latest articles → call-to-action → footer.
 *
 * Copy is drawn from Mavens' real details (mavens.co.ke). Imagery is
 * placeholder only — drop real assets into apps/web/public/ and swap the
 * `.mk-hero-art` / `.mk-portrait` / logo tiles when available.
 */

const NAV_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Programs', href: '#programs' },
  { label: 'Coaches', href: '#coaches' },
  { label: 'Donate', href: '#donors' },
  { label: 'Articles', href: '#articles' },
  { label: 'Contact', href: '#contact' }
];

// PLACEHOLDER coaches — replace with real roster once the Coaches API is public.
const COACHES = [
  { name: 'Coach — name pending', title: 'Junior development' },
  { name: 'Coach — name pending', title: 'Tournament preparation' },
  { name: 'Coach — name pending', title: 'Chess in Schools' }
];

// PLACEHOLDER articles — becomes live data in the Articles/News feature.
const SAMPLE_ARTICLES = [
  {
    date: 'Coming soon',
    title: 'Club news and coaching notes will appear here',
    excerpt:
      'Once the Articles module ships, posts published from the admin dashboard show up in this section for parents, students and the public.'
  },
  {
    date: 'Coming soon',
    title: 'Tournament recaps',
    excerpt: 'Results, standings and highlights from Mavens events and the schools league.'
  },
  {
    date: 'Coming soon',
    title: 'Learning the game',
    excerpt: 'Short lessons and puzzles from our coaches for players building their fundamentals.'
  }
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="mk">
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
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)}>
                {l.label}
              </a>
            ))}
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

      <main>
        {/* ---------- Hero ---------- */}
        <section className="mk-container mk-hero">
          <div>
            <p className="mk-eyebrow">Welcome to</p>
            <h1>Mavens Chess Club</h1>
            <p className="mk-tagline">Learn. Grow. Enjoy. Play chess.</p>
            <p className="mk-lead">
              A Nairobi-based chess and scholastic centre nurturing talent in players of every age and
              background across Kenya — building tactical thinking, skill, and sportsmanship one game at a
              time.
            </p>
            <div className="mk-hero-cta">
              <Link to="/join" className="btn btn-gold">
                Join the club
              </Link>
              <Link to="/login" className="btn btn-ghost">
                Sign in to your account
              </Link>
            </div>
          </div>
          <div className="mk-hero-art" role="img" aria-label="Chessboard illustration (placeholder)" />
        </section>

        {/* ---------- Stats ---------- */}
        <section className="mk-section alt">
          <div className="mk-container">
            <div className="mk-stats">
              {/* PLACEHOLDER figures — wire to real totals later. */}
              <div className="mk-stat">
                <b>500+</b>
                <span>Students trained</span>
              </div>
              <div className="mk-stat">
                <b>20+</b>
                <span>Schools served</span>
              </div>
              <div className="mk-stat">
                <b>10+</b>
                <span>Years of experience</span>
              </div>
              <div className="mk-stat">
                <b>30+</b>
                <span>Titles won</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- About ---------- */}
        <section className="mk-section" id="about">
          <div className="mk-container">
            <p className="mk-eyebrow">About us</p>
            <h2 className="mk-h2">A home for scholastic chess in Kenya</h2>
            <p className="mk-lead">
              Mavens Chess Club runs structured coaching for parents, juniors and aspiring trainers,
              organises competitive and inclusive tournaments, and partners with schools to bring chess
              into the classroom — including our Chess &amp; Mathematics and Chess &amp; Reading programmes.
            </p>
            <p className="mk-lead">
              Whether a child is picking up their first piece or preparing for a rated event, our coaches
              meet them where they are and take them forward.
            </p>
          </div>
        </section>

        {/* ---------- Programs ---------- */}
        <section className="mk-section alt" id="programs">
          <div className="mk-container">
            <p className="mk-eyebrow">What we do</p>
            <h2 className="mk-h2">Programs</h2>
            <div className="mk-grid-3">
              <article className="mk-card">
                <span className="mk-glyph" aria-hidden="true">♟</span>
                <h3>Chess Classes</h3>
                <p>
                  Weekly coaching for juniors and adults, grouped by level, with puzzles and homework
                  tracked between sessions.
                </p>
              </article>
              <article className="mk-card">
                <span className="mk-glyph" aria-hidden="true">♜</span>
                <h3>Tournaments &amp; Events</h3>
                <p>
                  Club rapids, the schools league and open events — competitive play in a supportive
                  environment.
                </p>
              </article>
              <article className="mk-card">
                <span className="mk-glyph" aria-hidden="true">♞</span>
                <h3>Chess in Schools</h3>
                <p>
                  Curriculum-linked chess delivered on-site with partner schools, pairing the game with
                  maths and reading.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ---------- Founder ---------- */}
        <section className="mk-section" id="founder">
          <div className="mk-container">
            <p className="mk-eyebrow">Our founder</p>
            <h2 className="mk-h2">Meet the coach behind Mavens</h2>
            <div className="mk-founder">
              <div className="mk-portrait">portrait placeholder</div>
              <div>
                <p className="mk-founder-name">Coach Tom Amwai</p>
                <p className="mk-founder-role">Founder &amp; Head Coach · FIDE Certified Developmental Instructor · Minichess Trainer</p>
                <p className="mk-lead">
                  Tom founded Mavens to make quality chess coaching accessible to more Kenyan families. He
                  leads the club's curriculum, mentors the coaching team, and still teaches on the floor
                  every week.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Coaches ---------- */}
        <section className="mk-section alt" id="coaches">
          <div className="mk-container">
            <p className="mk-eyebrow">The team</p>
            <h2 className="mk-h2">Meet our coaches</h2>
            <div className="mk-grid-3">
              {COACHES.map((c, i) => (
                <div className="mk-tile" key={i}>
                  <div className="mk-avatar" aria-hidden="true">♟</div>
                  <h3>{c.name}</h3>
                  <span>{c.title}</span>
                </div>
              ))}
            </div>
            <p className="mk-note">Placeholder roster — real coach profiles will be published from the club's Coaches records.</p>
          </div>
        </section>

        {/* ---------- Donors & Partners ---------- */}
        <section className="mk-section" id="donors">
          <div className="mk-container">
            <p className="mk-eyebrow">Support</p>
            <h2 className="mk-h2">Donors &amp; partners</h2>
            <p className="mk-lead">
              Mavens is supported by schools, partners and individual donors who help us reach more
              children and keep fees within reach. Interested in supporting the club?
            </p>
            <div style={{ marginTop: 18 }}>
              <Link to="/join" className="btn btn-gold btn-sm">
                Become a donor
              </Link>
            </div>
            <div className="mk-grid-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div className="mk-logo-tile" key={i}>
                  logo
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Latest articles ---------- */}
        <section className="mk-section alt" id="articles">
          <div className="mk-container">
            <p className="mk-eyebrow">From the club</p>
            <h2 className="mk-h2">Latest articles</h2>
            <div className="mk-grid-3">
              {SAMPLE_ARTICLES.map((a, i) => (
                <article className="mk-article" key={i}>
                  <div className="mk-article-thumb" aria-hidden="true" />
                  <div className="mk-article-body">
                    <span className="mk-date">{a.date}</span>
                    <h3>{a.title}</h3>
                    <p>{a.excerpt}</p>
                  </div>
                </article>
              ))}
            </div>
            <p className="mk-note">
              Placeholder previews. Publishing and the public article archive arrive with the Articles/News
              feature.
            </p>
          </div>
        </section>

        {/* ---------- CTA band ---------- */}
        <section className="mk-cta-band">
          <div className="mk-container">
            <h2>Ready to make your move?</h2>
            <p>Join Mavens Chess Club or sign in to your parent, student or coach account.</p>
            <div className="mk-cta-actions">
              <Link to="/join" className="btn btn-gold">
                Join the club
              </Link>
              <Link to="/login" className="btn btn-ghost">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="mk-footer" id="contact">
        <div className="mk-container">
          <div className="mk-footer-grid">
            <div className="mk-footer-brand">
              <div className="brand">
                <span className="brand-mark">♞</span>
                <span className="brand-name">Mavens Chess Club</span>
              </div>
              <p>Chess &amp; scholastic coaching for players of every age and background across Kenya.</p>
            </div>

            <div>
              <h4>Quick links</h4>
              <ul>
                <li><a href="#about">About</a></li>
                <li><a href="#programs">Programs</a></li>
                <li><a href="#coaches">Coaches</a></li>
                <li><a href="#articles">Articles</a></li>
                <li><Link to="/login">Sign in</Link></li>
              </ul>
            </div>

            <div>
              <h4>Contact</h4>
              <ul>
                <li>A108 Westlands Road, Nairobi</li>
                <li>+254 702 101 676</li>
                <li>+254 702 101 686</li>
                {/* PLACEHOLDER email — confirm the real address. */}
                <li><a href="mailto:info@mavens.co.ke">info@mavens.co.ke</a></li>
              </ul>
            </div>

            <div>
              <h4>Newsletter</h4>
              <ul>
                <li>Club updates, events and results.</li>
              </ul>
              {/* PLACEHOLDER — not wired to a backend yet. */}
              <form className="mk-newsletter" onSubmit={(e) => e.preventDefault()}>
                <input type="email" placeholder="you@example.com" aria-label="Email address" />
                <button type="submit" className="btn btn-gold btn-sm">
                  Subscribe
                </button>
              </form>
            </div>
          </div>

          <div className="mk-footer-bottom">
            <span>© {new Date().getFullYear()} Mavens Chess Club. All rights reserved.</span>
            <span>Nairobi, Kenya</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
