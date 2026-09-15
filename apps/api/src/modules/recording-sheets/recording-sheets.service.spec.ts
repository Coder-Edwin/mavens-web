import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RecordingSheetsService } from './recording-sheets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

describe('RecordingSheetsService', () => {
  let service: RecordingSheetsService;
  let prisma: any;

  const admin: AuthenticatedUser = { userId: 'admin-1', email: 'a@x.com', role: 'ADMIN', isCoach: false };
  const coach: AuthenticatedUser = { userId: 'coach-user-1', email: 'c@x.com', role: 'COACH', isCoach: true };
  const otherCoach: AuthenticatedUser = { userId: 'coach-user-2', email: 'c2@x.com', role: 'COACH', isCoach: true };
  const student: AuthenticatedUser = { userId: 'student-user-1', email: 's@x.com', role: 'STUDENT', isCoach: false };
  const parentUser: AuthenticatedUser = { userId: 'parent-user-1', email: 'p@x.com', role: 'PARENT', isCoach: false };

  const sheet = (over: Record<string, unknown> = {}) => ({
    id: 'rs-1',
    studentId: 'stu-1',
    imageUrl: 'https://example.com/sheet.jpg',
    uploadedAt: new Date('2026-01-01'),
    coachComment: null,
    reviewedById: null,
    reviewedAt: null,
    ...over
  });

  beforeEach(async () => {
    prisma = {
      studentProfile: { findUnique: jest.fn() },
      coachProfile: { findUnique: jest.fn() },
      parentProfile: { findUnique: jest.fn() },
      coachStudent: { findUnique: jest.fn() },
      parentStudent: { findUnique: jest.fn() },
      recordingSheet: {
        create: jest.fn((a: any) => Promise.resolve(sheet({ id: 'rs-1', ...a.data }))),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn((a: any) => Promise.resolve(sheet({ id: a.where.id, ...a.data }))),
        delete: jest.fn().mockResolvedValue({})
      }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [RecordingSheetsService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(RecordingSheetsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('404s on an unknown student', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ studentId: 'ghost', imageUrl: 'https://x.com/a.jpg' }, admin)
      ).rejects.toThrow(NotFoundException);
    });

    it('blocks a coach who is not assigned to the student', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'stu-1' });
      prisma.coachProfile.findUnique.mockResolvedValue({ id: 'coach-2' });
      prisma.coachStudent.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ studentId: 'stu-1', imageUrl: 'https://x.com/a.jpg' }, otherCoach)
      ).rejects.toThrow(ForbiddenException);
    });

    it('lets the assigned coach upload a sheet', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'stu-1' });
      prisma.coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      prisma.coachStudent.findUnique.mockResolvedValue({ coachId: 'coach-1', studentId: 'stu-1' });
      const created = await service.create(
        { studentId: 'stu-1', imageUrl: 'https://x.com/a.jpg', coachComment: '  Nice endgame  ' },
        coach
      );
      expect(created.imageUrl).toBe('https://x.com/a.jpg');
      expect(prisma.recordingSheet.create.mock.calls[0][0].data.coachComment).toBe('Nice endgame');
    });

    it('lets an admin upload for any student', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'stu-1' });
      await expect(
        service.create({ studentId: 'stu-1', imageUrl: 'https://x.com/a.jpg' }, admin)
      ).resolves.toBeDefined();
    });
  });

  describe('findForStudent', () => {
    it('blocks an unlinked parent', async () => {
      prisma.parentProfile.findUnique.mockResolvedValue({ id: 'parent-2' });
      prisma.parentStudent.findUnique.mockResolvedValue(null);
      await expect(service.findForStudent('stu-1', parentUser)).rejects.toThrow(ForbiddenException);
    });

    it('lets a linked parent view them', async () => {
      prisma.parentProfile.findUnique.mockResolvedValue({ id: 'parent-1' });
      prisma.parentStudent.findUnique.mockResolvedValue({ parentId: 'parent-1', studentId: 'stu-1' });
      await expect(service.findForStudent('stu-1', parentUser)).resolves.toEqual([]);
    });

    it('blocks a student viewing someone else’s sheets', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'some-other-student' });
      await expect(service.findForStudent('stu-1', student)).rejects.toThrow(ForbiddenException);
    });

    it('lets a student view their own sheets', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'stu-1' });
      await expect(service.findForStudent('stu-1', student)).resolves.toEqual([]);
    });
  });

  describe('update', () => {
    it('404s on an unknown sheet', async () => {
      prisma.recordingSheet.findUnique.mockResolvedValue(null);
      await expect(service.update('ghost', { coachComment: 'x' }, coach)).rejects.toThrow(NotFoundException);
    });

    it('stamps the reviewing coach and timestamp when a comment is set', async () => {
      prisma.recordingSheet.findUnique.mockResolvedValue(sheet());
      prisma.coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      prisma.coachStudent.findUnique.mockResolvedValue({ coachId: 'coach-1', studentId: 'stu-1' });
      await service.update('rs-1', { coachComment: 'Great tactics here' }, coach);
      const data = prisma.recordingSheet.update.mock.calls[0][0].data;
      expect(data).toMatchObject({ coachComment: 'Great tactics here', reviewedById: 'coach-1' });
      expect(data.reviewedAt).toBeInstanceOf(Date);
    });

    it('rejects a student trying to comment', async () => {
      prisma.recordingSheet.findUnique.mockResolvedValue(sheet());
      await expect(service.update('rs-1', { coachComment: 'x' }, student)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('refuses a non-admin', async () => {
      await expect(service.remove('rs-1', coach)).rejects.toThrow(ForbiddenException);
    });

    it('404s on an unknown sheet', async () => {
      prisma.recordingSheet.findUnique.mockResolvedValue(null);
      await expect(service.remove('ghost', admin)).rejects.toThrow(NotFoundException);
    });

    it('lets an admin delete', async () => {
      prisma.recordingSheet.findUnique.mockResolvedValue(sheet());
      await expect(service.remove('rs-1', admin)).resolves.toEqual({ id: 'rs-1' });
    });
  });
});
