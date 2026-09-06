import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { articlesApi, formatArticleDate, type ArticleSummary } from '@/lib/articles';
import '@/styles/marketing.css';

/** Public /articles — the full published archive. */
export function ArticlesPage() {
  const [articles, setArticles] = useState<ArticleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await articlesApi.listPublic();
        if (!cancelled) setArticles(rows);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load articles', err);
        setError('Could not load articles right now — please try again shortly.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mk">
      <MarketingHeader />
      <main className="mk-container mk-page">
        <div className="mk-page-head">
          <p className="mk-eyebrow">From the club</p>
          <h1 className="mk-h2" style={{ fontSize: 34 }}>
            Articles &amp; news
          </h1>
        </div>

        {error && <div className="mk-empty">{error}</div>}

        {!error && !articles && <div className="mk-empty">Loading articles…</div>}

        {!error && articles && articles.length === 0 && (
          <div className="mk-empty">No articles have been published yet — check back soon.</div>
        )}

        {articles && articles.length > 0 && (
          <div className="mk-article-list">
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
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
