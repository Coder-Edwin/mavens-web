import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Chip, Button } from '@/components/ui/Primitives';
import { ApiError } from '@/lib/api-client';
import { articlesApi, formatArticleDate, type AdminArticle, type ArticleInput } from '@/lib/articles';

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 6,
  marginBottom: 14,
  padding: '9px 11px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--panel-alt)',
  color: 'var(--text)',
  fontFamily: 'var(--font-body)',
  fontSize: 13
};
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--muted)',
  letterSpacing: '0.04em'
};

const EMPTY: ArticleInput = { title: '', excerpt: '', body: '', coverImageUrl: '', status: 'DRAFT' };

export function ArticlesAdmin() {
  const [articles, setArticles] = useState<AdminArticle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // null = not editing, '' = new
  const [form, setForm] = useState<ArticleInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      setArticles(await articlesApi.listAdmin());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load articles.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startNew() {
    setForm(EMPTY);
    setEditingId('');
  }

  function startEdit(a: AdminArticle) {
    setForm({
      title: a.title,
      excerpt: a.excerpt,
      body: a.body,
      coverImageUrl: a.coverImageUrl ?? '',
      status: a.status
    });
    setEditingId(a.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const trimmedCover = form.coverImageUrl?.trim() || '';
      if (editingId) {
        // On edit, an empty field is an explicit "remove the image" (null);
        // on create, an empty field is simply omitted.
        await articlesApi.update(editingId, {
          ...form,
          coverImageUrl: trimmedCover ? trimmedCover : null
        });
      } else {
        await articlesApi.create({
          ...form,
          coverImageUrl: trimmedCover ? trimmedCover : undefined
        });
      }
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the article.');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(a: AdminArticle) {
    setBusyId(a.id);
    setError(null);
    try {
      await articlesApi.update(a.id, { status: a.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the article.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(a: AdminArticle) {
    if (!window.confirm(`Delete “${a.title}”? This cannot be undone.`)) return;
    setBusyId(a.id);
    setError(null);
    try {
      await articlesApi.remove(a.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the article.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Articles</div>
          <div className="page-sub">
            <Link to="/app" style={{ color: 'var(--gold-soft)' }}>
              ← Back to overview
            </Link>
          </div>
        </div>
        {editingId === null && <Button onClick={startNew}>New article</Button>}
      </div>

      {error && (
        <div className="alert-card" style={{ marginBottom: 16 }}>
          <b>Error —</b> {error}
        </div>
      )}

      {editingId !== null && (
        <div style={{ marginBottom: 20 }}>
          <Panel title={editingId ? 'Edit article' : 'New article'}>
            <form onSubmit={handleSubmit}>
              <label style={labelStyle} htmlFor="art-title">
                Title
              </label>
              <input
                id="art-title"
                style={inputStyle}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />

              <label style={labelStyle} htmlFor="art-excerpt">
                Excerpt <span style={{ opacity: 0.6 }}>— shown in listings</span>
              </label>
              <textarea
                id="art-excerpt"
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                required
              />

              <label style={labelStyle} htmlFor="art-body">
                Body <span style={{ opacity: 0.6 }}>— blank lines separate paragraphs</span>
              </label>
              <textarea
                id="art-body"
                style={{ ...inputStyle, minHeight: 200, resize: 'vertical', fontFamily: 'var(--font-body)' }}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                required
              />

              <label style={labelStyle} htmlFor="art-cover">
                Cover image URL <span style={{ opacity: 0.6 }}>— optional</span>
              </label>
              <input
                id="art-cover"
                style={inputStyle}
                value={form.coverImageUrl}
                onChange={(e) => setForm((f) => ({ ...f, coverImageUrl: e.target.value }))}
                placeholder="https://…"
              />

              <label style={labelStyle} htmlFor="art-status">
                Status
              </label>
              <select
                id="art-status"
                style={inputStyle}
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as ArticleInput['status'] }))
                }
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create article'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <Panel title="All articles">
        {!articles && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
            Loading…
          </div>
        )}
        {articles && articles.length === 0 && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
            No articles yet. Use “New article” to write the first one.
          </div>
        )}
        {articles && articles.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Published</th>
                <th>Updated</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.status === 'PUBLISHED' ? (
                      <a
                        href={`/articles/${a.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--text)' }}
                      >
                        {a.title}
                      </a>
                    ) : (
                      a.title
                    )}
                  </td>
                  <td>
                    <Chip
                      status={a.status === 'PUBLISHED' ? 'paid' : 'pending'}
                      label={a.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                    />
                  </td>
                  <td className="mono">{a.publishedAt ? formatArticleDate(a.publishedAt) : '—'}</td>
                  <td className="mono">{formatArticleDate(a.updatedAt)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => startEdit(a)}
                      style={{ marginRight: 6 }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => togglePublish(a)}
                      disabled={busyId === a.id}
                      style={{ marginRight: 6 }}
                    >
                      {a.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => remove(a)}
                      disabled={busyId === a.id}
                      style={{ color: 'var(--red)' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
