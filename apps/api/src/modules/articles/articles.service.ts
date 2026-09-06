import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

/// Turns "Rook Endgames: The Lucena Position!" into "rook-endgames-the-lucena-position".
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip decomposed accent marks
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || 'article';
}

/// Cap on the public `?limit=` so a caller can't ask for an unbounded page.
export const MAX_PUBLIC_LIMIT = 50;

/// Accept only a positive integer; cap it at MAX_PUBLIC_LIMIT. Anything else
/// (fractional, negative, zero, NaN, undefined) means "no limit".
export function normalizeLimit(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isInteger(value) || value < 1) return undefined;
  return Math.min(value, MAX_PUBLIC_LIMIT);
}

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Public reads ---------------------------------------------------------

  /// Published, already-live posts only, newest first. `limit` backs the
  /// landing page's "Latest articles" strip.
  findPublished(limit?: number) {
    return this.prisma.article.findMany({
      where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: 'desc' },
      take: normalizeLimit(limit),
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        coverImageUrl: true,
        publishedAt: true
      }
    });
  }

  async findPublishedBySlug(slug: string) {
    const article = await this.prisma.article.findFirst({
      where: { slug, status: 'PUBLISHED', publishedAt: { lte: new Date() } },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        body: true,
        coverImageUrl: true,
        publishedAt: true
      }
    });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  // ---- Admin ---------------------------------------------------------------

  /// Everything, drafts included, most-recently-touched first.
  findAllForAdmin() {
    return this.prisma.article.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { author: { select: { email: true } } }
    });
  }

  async create(dto: CreateArticleDto, currentUser: AuthenticatedUser) {
    const status = dto.status ?? 'DRAFT';
    return this.prisma.article.create({
      data: {
        slug: await this.uniqueSlug(slugify(dto.title)),
        title: dto.title,
        excerpt: dto.excerpt,
        body: dto.body,
        coverImageUrl: dto.coverImageUrl,
        status,
        // A post created straight as PUBLISHED goes live now.
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        authorId: currentUser.userId
      }
    });
  }

  async update(id: string, dto: UpdateArticleDto) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }

    // First time it goes PUBLISHED, stamp publishedAt. Un-publishing keeps
    // the original timestamp so re-publishing doesn't reorder the feed.
    let publishedAt = existing.publishedAt;
    if (dto.status === 'PUBLISHED' && !existing.publishedAt) {
      publishedAt = new Date();
    }

    // The slug is the article's permalink — keep it stable even if the
    // title is edited later.
    return this.prisma.article.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        excerpt: dto.excerpt ?? undefined,
        body: dto.body ?? undefined,
        // Three states: omitted (undefined) leaves it untouched; an explicit
        // null clears the cover image; a string sets it.
        coverImageUrl: dto.coverImageUrl,
        status: dto.status ?? undefined,
        publishedAt
      }
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }
    await this.prisma.article.delete({ where: { id } });
    return { id };
  }

  /// Appends -2, -3, … until the slug is free.
  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base;
    let n = 2;
    // eslint-disable-next-line no-await-in-loop
    while (await this.prisma.article.findUnique({ where: { slug: candidate } })) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    return candidate;
  }
}
