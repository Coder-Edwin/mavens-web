import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ArticlesService, slugify, normalizeLimit, MAX_PUBLIC_LIMIT } from './articles.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

describe('slugify', () => {
  it('lowercases, drops punctuation and collapses spaces to single hyphens', () => {
    expect(slugify('Rook Endgames: The Lucena Position!')).toBe('rook-endgames-the-lucena-position');
  });

  it('trims leading/trailing separators', () => {
    expect(slugify('  --Hello, World--  ')).toBe('hello-world');
  });

  it('strips accents', () => {
    expect(slugify('Réti Opening')).toBe('reti-opening');
  });

  it('falls back to "article" when nothing usable remains', () => {
    expect(slugify('!!! ???')).toBe('article');
  });
});

describe('normalizeLimit', () => {
  it('passes a valid positive integer through unchanged', () => {
    expect(normalizeLimit(3)).toBe(3);
  });

  it('ignores a fractional limit', () => {
    expect(normalizeLimit(1.5)).toBeUndefined();
  });

  it('ignores a negative or zero limit', () => {
    expect(normalizeLimit(-4)).toBeUndefined();
    expect(normalizeLimit(0)).toBeUndefined();
  });

  it('ignores NaN and undefined', () => {
    expect(normalizeLimit(Number('abc'))).toBeUndefined();
    expect(normalizeLimit(undefined)).toBeUndefined();
  });

  it('caps an oversized limit at MAX_PUBLIC_LIMIT', () => {
    expect(normalizeLimit(1000)).toBe(MAX_PUBLIC_LIMIT);
  });
});

describe('ArticlesService', () => {
  let service: ArticlesService;
  let prisma: {
    article: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const admin: AuthenticatedUser = {
    userId: 'admin-1',
    email: 'amwai@mavenschessclub.com',
    role: 'ADMIN',
    isCoach: true
  };

  beforeEach(async () => {
    prisma = {
      article: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn((args) => Promise.resolve({ id: 'new-1', ...args.data })),
        update: jest.fn((args) => Promise.resolve({ id: args.where.id, ...args.data })),
        delete: jest.fn().mockResolvedValue({})
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ArticlesService, { provide: PrismaService, useValue: prisma }]
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('derives a slug from the title and defaults to an unpublished draft', async () => {
      prisma.article.findUnique.mockResolvedValue(null); // slug is free

      const result = await service.create(
        { title: 'Winning with the London System', excerpt: 'x', body: 'y' },
        admin
      );

      const data = prisma.article.create.mock.calls[0][0].data;
      expect(data.slug).toBe('winning-with-the-london-system');
      expect(data.status).toBe('DRAFT');
      expect(data.publishedAt).toBeNull();
      expect(data.authorId).toBe('admin-1');
      expect(result.id).toBe('new-1');
    });

    it('stamps publishedAt when created straight as PUBLISHED', async () => {
      prisma.article.findUnique.mockResolvedValue(null);

      await service.create(
        { title: 'Club news', excerpt: 'x', body: 'y', status: 'PUBLISHED' },
        admin
      );

      const data = prisma.article.create.mock.calls[0][0].data;
      expect(data.status).toBe('PUBLISHED');
      expect(data.publishedAt).toBeInstanceOf(Date);
    });

    it('appends a numeric suffix when the derived slug is already taken', async () => {
      prisma.article.findUnique
        .mockResolvedValueOnce({ id: 'existing' }) // "club-news" taken
        .mockResolvedValueOnce({ id: 'existing2' }) // "club-news-2" taken
        .mockResolvedValueOnce(null); // "club-news-3" free

      await service.create({ title: 'Club News', excerpt: 'x', body: 'y' }, admin);

      expect(prisma.article.create.mock.calls[0][0].data.slug).toBe('club-news-3');
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the article does not exist', async () => {
      prisma.article.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { title: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('stamps publishedAt the first time a draft is published', async () => {
      prisma.article.findUnique.mockResolvedValue({ id: 'a1', slug: 's', publishedAt: null });

      await service.update('a1', { status: 'PUBLISHED' });

      expect(prisma.article.update.mock.calls[0][0].data.publishedAt).toBeInstanceOf(Date);
    });

    it('keeps the original publishedAt when unpublishing', async () => {
      const original = new Date('2026-01-01T00:00:00Z');
      prisma.article.findUnique.mockResolvedValue({ id: 'a1', slug: 's', publishedAt: original });

      await service.update('a1', { status: 'DRAFT' });

      expect(prisma.article.update.mock.calls[0][0].data.publishedAt).toBe(original);
    });

    it('never rewrites the slug, even when the title changes', async () => {
      prisma.article.findUnique.mockResolvedValue({ id: 'a1', slug: 'old-slug', publishedAt: null });

      await service.update('a1', { title: 'A Completely Different Title' });

      expect(prisma.article.update.mock.calls[0][0].data).not.toHaveProperty('slug');
    });

    it('clears the cover image when coverImageUrl is explicitly null', async () => {
      prisma.article.findUnique.mockResolvedValue({ id: 'a1', slug: 's', publishedAt: null });

      await service.update('a1', { coverImageUrl: null });

      expect(prisma.article.update.mock.calls[0][0].data.coverImageUrl).toBeNull();
    });

    it('leaves the cover image untouched when coverImageUrl is omitted', async () => {
      prisma.article.findUnique.mockResolvedValue({ id: 'a1', slug: 's', publishedAt: null });

      await service.update('a1', { title: 'New title' });

      expect(prisma.article.update.mock.calls[0][0].data.coverImageUrl).toBeUndefined();
    });

    it('sets the cover image when coverImageUrl is a string', async () => {
      prisma.article.findUnique.mockResolvedValue({ id: 'a1', slug: 's', publishedAt: null });

      await service.update('a1', { coverImageUrl: 'https://img.example/x.jpg' });

      expect(prisma.article.update.mock.calls[0][0].data.coverImageUrl).toBe('https://img.example/x.jpg');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the article does not exist', async () => {
      prisma.article.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('deletes an existing article and returns its id', async () => {
      prisma.article.findUnique.mockResolvedValue({ id: 'a1' });
      await expect(service.remove('a1')).resolves.toEqual({ id: 'a1' });
      expect(prisma.article.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    });
  });

  describe('public reads', () => {
    it('findPublished filters to live PUBLISHED posts, newest first, honouring limit', async () => {
      prisma.article.findMany.mockResolvedValue([]);
      await service.findPublished(3);

      const arg = prisma.article.findMany.mock.calls[0][0];
      expect(arg.where.status).toBe('PUBLISHED');
      expect(arg.where.publishedAt.lte).toBeInstanceOf(Date);
      expect(arg.orderBy).toEqual({ publishedAt: 'desc' });
      expect(arg.take).toBe(3);
    });

    it('findPublished ignores a non-positive or fractional limit', async () => {
      prisma.article.findMany.mockResolvedValue([]);
      await service.findPublished(0);
      expect(prisma.article.findMany.mock.calls[0][0].take).toBeUndefined();
      await service.findPublished(2.7);
      expect(prisma.article.findMany.mock.calls[1][0].take).toBeUndefined();
    });

    it('findPublished caps an oversized limit', async () => {
      prisma.article.findMany.mockResolvedValue([]);
      await service.findPublished(9999);
      expect(prisma.article.findMany.mock.calls[0][0].take).toBe(MAX_PUBLIC_LIMIT);
    });

    it('findPublishedBySlug throws NotFoundException for an unknown or draft slug', async () => {
      prisma.article.findFirst.mockResolvedValue(null);
      await expect(service.findPublishedBySlug('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
