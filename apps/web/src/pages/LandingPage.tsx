import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { articlesApi, formatArticleDate, type ArticleSummary } from '@/lib/articles';
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

// PLACEHOLDER coaches — replace with real roster once the Coaches API is public.
const COACHES = [
  { name: 'Coach — name pending', title: 'Junior development' },
  { name: 'Coach — name pending', title: 'Tournament preparation' },
  { name: 'Coach — name pending', title: 'Chess in Schools' }
];

/** Latest-articles strip — real published posts, with a graceful fallback. */
function LatestArticles() {
  const [articles, setArticles] = useState<ArticleSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // The landing page must render even if the API is down.
    articlesApi
      .listPublic(3)
      .then(setArticles)
      .catch(() => setFailed(true));
  }, []);

  return (
    <section className="mk-section alt" id="articles">
      <div className="mk-container">
        <p className="mk-eyebrow">From the club</p>
        <h2 className="mk-h2">Latest articles</h2>

        {articles && articles.length > 0 ? (
          <>
            <div className="mk-grid-3">
              {articles.map((a) => (
                <Link key={a.id} to={`/articles/${a.slug}`} className="mk-article">
                  {a.coverImageUrl ? (
                    <img className="mk-article-thumb" src={a.coverImageUrl} alt="" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div className="mk-article-thumb" aria-hidden="true" />
                  )}
                  <div className="mk-article-body">
                    <span className="mk-date">{formatArticleDate(a.publishedAt)}</span>
                    <h3>{a.title}</h3>
                    <p>{a.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
            <p style={{ marginTop: 22 }}>
              <Link to="/articles" className="btn btn-ghost btn-sm">
                View all articles
              </Link>
            </p>
          </>
        ) : (
          <p className="mk-note">
            {failed
              ? 'Articles are unavailable right now — please check back shortly.'
              : articles
                ? 'No articles have been published yet — check back soon.'
                : 'Loading the latest posts…'}
          </p>
        )}
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <div className="mk">
      <MarketingHeader variant="home" />

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
        <LatestArticles />

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

      <MarketingFooter />
    </div>
  );
}
