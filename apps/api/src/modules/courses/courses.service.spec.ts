import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const admin: AuthenticatedUser = { userId: 'admin-1', email: 'a@x.com', role: 'ADMIN', isCoach: false };
const student: AuthenticatedUser = { userId: 'user-1', email: 's@x.com', role: 'STUDENT', isCoach: false };

describe('CoursesService', () => {
  let service: CoursesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      course: {
        create: jest.fn((a: any) => Promise.resolve({ id: 'c-1', ...a.data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn((a: any) => Promise.resolve({ id: a.where.id, ...a.data })),
        delete: jest.fn().mockResolvedValue({})
      },
      courseModule: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), aggregate: jest.fn().mockResolvedValue({ _max: { position: null } }) },
      courseLesson: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn(), aggregate: jest.fn().mockResolvedValue({ _max: { position: 2 } }) },
      courseAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn((a: any) => Promise.resolve({ id: 'a-1', ...a.data })),
        delete: jest.fn()
      },
      lessonCompletion: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({}),
        count: jest.fn()
      },
      studentProfile: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [CoursesService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(CoursesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createCourse', () => {
    it('slugifies the title and records the author', async () => {
      prisma.course.findUnique.mockResolvedValue(null); // slug free
      await service.createCourse({ title: 'Rook Endgames: Lucena!' }, admin);
      const data = prisma.course.create.mock.calls[0][0].data;
      expect(data.slug).toBe('rook-endgames-lucena');
      expect(data.status).toBe('DRAFT');
      expect(data.createdById).toBe('admin-1');
    });
  });

  describe('assign', () => {
    it('refuses to assign a course that is not published', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'c-1', status: 'DRAFT' });
      await expect(service.assign('c-1', { studentIds: ['11111111-1111-4111-8111-111111111111'] }, admin)).rejects.toThrow(
        BadRequestException
      );
    });

    it('creates assignments only for students not already assigned', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'c-1', status: 'PUBLISHED' });
      prisma.studentProfile.findMany.mockResolvedValue([{ id: 'stu-1' }, { id: 'stu-2' }]);
      prisma.courseAssignment.findMany.mockResolvedValue([{ studentId: 'stu-1' }]);
      const res = await service.assign('c-1', { studentIds: ['stu-1', 'stu-2'] }, admin);
      expect(res).toEqual({ assigned: 1, skipped: 1 });
      expect(prisma.courseAssignment.createMany.mock.calls[0][0].data).toEqual([
        expect.objectContaining({ courseId: 'c-1', studentId: 'stu-2', assignedById: 'admin-1' })
      ]);
    });
  });

  describe('completeLesson', () => {
    beforeEach(() => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'stu-1' });
      prisma.courseLesson.findUnique.mockResolvedValue({ id: 'les-1', module: { courseId: 'c-1' } });
      prisma.courseAssignment.findUnique.mockResolvedValue({
        courseId: 'c-1',
        studentId: 'stu-1',
        startedAt: null,
        completedAt: null
      });
    });

    it('moves the assignment to IN_PROGRESS on the first completion', async () => {
      prisma.courseLesson.count.mockResolvedValue(4);
      prisma.lessonCompletion.count.mockResolvedValue(1);
      await service.completeLesson(student, 'les-1');
      const data = prisma.courseAssignment.update.mock.calls[0][0].data;
      expect(data.status).toBe('IN_PROGRESS');
      expect(data.startedAt).toBeInstanceOf(Date);
      expect(data.completedAt).toBeNull();
    });

    it('marks the assignment COMPLETED when every lesson is done', async () => {
      prisma.courseLesson.count.mockResolvedValue(4);
      prisma.lessonCompletion.count.mockResolvedValue(4);
      await service.completeLesson(student, 'les-1');
      const data = prisma.courseAssignment.update.mock.calls[0][0].data;
      expect(data.status).toBe('COMPLETED');
      expect(data.completedAt).toBeInstanceOf(Date);
    });

    it('rejects a lesson from a course not assigned to the student', async () => {
      prisma.courseAssignment.findUnique.mockResolvedValue(null);
      await expect(service.completeLesson(student, 'les-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('uncompleteLesson', () => {
    it('drops back to ASSIGNED when the last completion is removed', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'stu-1' });
      prisma.courseLesson.findUnique.mockResolvedValue({ id: 'les-1', module: { courseId: 'c-1' } });
      prisma.courseAssignment.findUnique.mockResolvedValue({ courseId: 'c-1', studentId: 'stu-1', startedAt: new Date(), completedAt: null });
      prisma.courseLesson.count.mockResolvedValue(4);
      prisma.lessonCompletion.count.mockResolvedValue(0);
      await service.uncompleteLesson(student, 'les-1');
      expect(prisma.courseAssignment.update.mock.calls[0][0].data.status).toBe('ASSIGNED');
    });
  });

  describe('myCourse', () => {
    it('404s when the course is not assigned to the caller', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'stu-1' });
      prisma.courseAssignment.findUnique.mockResolvedValue(null);
      await expect(service.myCourse(student, 'c-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeCourse', () => {
    it('refuses to delete a course with assignments', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'c-1', _count: { assignments: 3 } });
      await expect(service.removeCourse('c-1')).rejects.toThrow(BadRequestException);
    });
  });
});
