import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StudentsService } from './students.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

describe('StudentsService', () => {
  let service: StudentsService;
  let prisma: {
    studentProfile: { findUnique: jest.Mock };
    coachProfile: { findUnique: jest.Mock };
    parentProfile: { findUnique: jest.Mock };
  };

  // Mirrors Faith's real shape: assigned to coach-1, linked to parent-1.
  const baseStudent = {
    id: 'student-1',
    userId: 'student-user-1',
    coachLinks: [{ coachId: 'coach-1' }],
    parentLinks: [{ parentId: 'parent-1' }]
  };

  beforeEach(async () => {
    prisma = {
      studentProfile: { findUnique: jest.fn() },
      coachProfile: { findUnique: jest.fn() },
      parentProfile: { findUnique: jest.fn() }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StudentsService, { provide: PrismaService, useValue: prisma }]
    }).compile();

    service = module.get<StudentsService>(StudentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findOne — ownership checks', () => {
    it('throws NotFoundException when the student does not exist', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(null);
      const admin: AuthenticatedUser = { userId: 'admin-1', email: 'a@x.com', role: 'ADMIN', isCoach: false };

      await expect(service.findOne('missing-id', admin)).rejects.toThrow(NotFoundException);
    });

    it('lets an ADMIN view any student', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(baseStudent);
      const admin: AuthenticatedUser = { userId: 'admin-1', email: 'a@x.com', role: 'ADMIN', isCoach: false };

      await expect(service.findOne(baseStudent.id, admin)).resolves.toEqual(baseStudent);
    });

    it('lets a STUDENT view their own profile', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(baseStudent);
      const self: AuthenticatedUser = {
        userId: baseStudent.userId,
        email: 's@x.com',
        role: 'STUDENT',
        isCoach: false
      };

      await expect(service.findOne(baseStudent.id, self)).resolves.toEqual(baseStudent);
    });

    // This is the exact scenario Faith proved manually: trying to view
    // Brian's profile and getting rejected.
    it("blocks a STUDENT from viewing a different student's profile", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(baseStudent);
      const someoneElse: AuthenticatedUser = {
        userId: 'a-totally-different-user',
        email: 's2@x.com',
        role: 'STUDENT',
        isCoach: false
      };

      await expect(service.findOne(baseStudent.id, someoneElse)).rejects.toThrow(ForbiddenException);
    });

    it('lets the assigned coach view the student', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(baseStudent);
      prisma.coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' }); // matches baseStudent.coachLinks
      const coach: AuthenticatedUser = { userId: 'coach-user-1', email: 'c@x.com', role: 'COACH', isCoach: true };

      await expect(service.findOne(baseStudent.id, coach)).resolves.toEqual(baseStudent);
    });

    it('blocks a different coach from viewing the student', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(baseStudent);
      prisma.coachProfile.findUnique.mockResolvedValue({ id: 'some-other-coach-id' }); // does NOT match
      const coach: AuthenticatedUser = { userId: 'coach-user-2', email: 'c2@x.com', role: 'COACH', isCoach: true };

      await expect(service.findOne(baseStudent.id, coach)).rejects.toThrow(ForbiddenException);
    });

    it('lets a linked parent view the student', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(baseStudent);
      prisma.parentProfile.findUnique.mockResolvedValue({ id: 'parent-1' }); // matches baseStudent.parentLinks
      const parent: AuthenticatedUser = { userId: 'parent-user-1', email: 'p@x.com', role: 'PARENT', isCoach: false };

      await expect(service.findOne(baseStudent.id, parent)).resolves.toEqual(baseStudent);
    });

    // This is Grace-and-Brian's scenario: a real parent account, just not
    // linked to THIS particular student.
    it('blocks an unlinked parent from viewing the student', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(baseStudent);
      prisma.parentProfile.findUnique.mockResolvedValue({ id: 'some-other-parent-id' });
      const parent: AuthenticatedUser = { userId: 'parent-user-2', email: 'p2@x.com', role: 'PARENT', isCoach: false };

      await expect(service.findOne(baseStudent.id, parent)).rejects.toThrow(ForbiddenException);
    });
  });
});
