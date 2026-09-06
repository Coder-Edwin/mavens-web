import { api } from './api-client';

export type ArticleStatus = 'DRAFT' | 'PUBLISHED';

/** Shape returned by the public list endpoint (GET /articles). */
export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
}

/** Public single-article endpoint (GET /articles/:slug). */
export interface ArticleDetail extends ArticleSummary {
  body: string;
}

/** Admin listing (GET /articles/admin) — drafts included. */
export interface AdminArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string | null;
  status: ArticleStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: { email: string } | null;
}

export interface ArticleInput {
  title: string;
  excerpt: string;
  body: string;
  // string sets it, null clears it (on edit), undefined leaves it alone.
  coverImageUrl?: string | null;
  status?: ArticleStatus;
}

export const articlesApi = {
  listPublic: (limit?: number) =>
    api.get<ArticleSummary[]>(`/articles${limit ? `?limit=${limit}` : ''}`),
  getBySlug: (slug: string) => api.get<ArticleDetail>(`/articles/${encodeURIComponent(slug)}`),
  listAdmin: () => api.get<AdminArticle[]>('/articles/admin'),
  create: (input: ArticleInput) => api.post<AdminArticle>('/articles', input),
  update: (id: string, input: Partial<ArticleInput>) =>
    api.patch<AdminArticle>(`/articles/${id}`, input),
  remove: (id: string) => api.del<{ id: string }>(`/articles/${id}`)
};

export function formatArticleDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/** Splits a plain-text body into paragraphs on blank lines. No markdown lib. */
export function bodyParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
