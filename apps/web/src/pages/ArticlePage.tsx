import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import {
  articlesApi,
  bodyParagraphs,
  formatArticleDate,
  type ArticleDetail
} from '@/lib/articles';
import { ApiError } from '@/lib/api-client';
import '@/styles/marketing.css';

/** Public /articles/:slug — one published post. */
export function ArticlePage() {
  const { slug = '' } = useParams();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const a = await articlesApi.getBySlug(slug);
        if (cancelled) return;
        setArticle(a);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setStatus('notfound');
        else setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="mk">
      <MarketingHeader />
      <main className="mk-container mk-page">
        <p style={{ marginBottom: 24 }}>
          <Link to="/articles" className="mk-back">
            ← All articles
          </Link>
        </p>

        {status === 'loading' && <div className="mk-empty">Loading…</div>}

        {status === 'notfound' && (
          <div className="mk-empty">
            That article doesn’t exist or hasn’t been published. <Link to="/articles">Browse all articles</Link>.
          </div>
        )}

        {status === 'error' && (
          <div className="mk-empty">Something went wrong loading this article. Please try again.</div>
        )}

        {status === 'ready' && article && (
          <article className="mk-post">
            <p className="mk-eyebrow">Article</p>
            <h1>{article.title}</h1>
            <p className="mk-post-meta">{formatArticleDate(article.publishedAt)}</p>
            {article.coverImageUrl && (
              <img className="mk-post-cover" src={article.coverImageUrl} alt="" />
            )}
            <p className="mk-post-lead">{article.excerpt}</p>
            <div className="mk-post-body">
              {bodyParagraphs(article.body).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </article>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
