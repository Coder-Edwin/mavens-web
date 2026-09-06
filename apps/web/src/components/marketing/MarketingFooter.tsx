import { Link } from 'react-router-dom';

/** Shared public-site footer. Section links point at the landing page's anchors. */
export function MarketingFooter() {
  return (
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
              <li><a href="/#about">About</a></li>
              <li><a href="/#programs">Programs</a></li>
              <li><a href="/#coaches">Coaches</a></li>
              <li><Link to="/articles">Articles</Link></li>
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
  );
}
