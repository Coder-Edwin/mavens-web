import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StudentsService } from './students.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

describe('StudentsService', () => {
  let service: StudentsService;
  let prisma: {
    studentProfile: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    coachProfile: { findUnique: jest.Mock };
    parentProfile: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock; create: jest.Mock };
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
      studentProfile: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      coachProfile: { findUnique: jest.fn() },
      parentProfile: { findUnique: jest.fn() },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn((a: any) =>
          Promise.resolve({ id: 'new-user', email: a.data.email, studentProfile: { id: 'new-student', ...a.data.studentProfile.create } })
        )
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StudentsService, { provide: PrismaService, useValue: prisma }]
    }).compile();

    service = module.get<StudentsService>(StudentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('refuses a duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create({ email: 'taken@x.com', firstName: 'Faith', lastName: 'Wambui' })
      ).rejects.toThrow(ConflictException);
    });

    it('creates the student with a temp password and persists optional fields', async () => {
      const result = await service.create({
        email: 'faith@x.com',
        firstName: 'Faith',
        lastName: 'Wambui',
        homeAddress: '  12 Ngong Rd  ',
        priorExperience: 'Two years of club play'
      });
      expect(result.tempPassword).toHaveLength(12); // 6 bytes as hex
      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data.studentProfile.create).toMatchObject({
        firstName: 'Faith',
        lastName: 'Wambui',
        homeAddress: '12 Ngong Rd',
        priorExperience: 'Two years of club play'
      });
    });

    it('links a coach when coachId is given', async () => {
      await service.create({ email: 'faith@x.com', firstName: 'Faith', lastName: 'Wambui', coachId: 'coach-1' });
      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data.studentProfile.create.coachLinks).toEqual({ create: { coachId: 'coach-1' } });
    });
  });

  describe('findAll', () => {
    it('returns every student for an admin, including their login email', async () => {
      const admin: AuthenticatedUser = { userId: 'admin-1', email: 'a@x.com', role: 'ADMIN', isCoach: false };
      await service.findAll(admin);
      const call = prisma.studentProfile.findMany.mock.calls[0][0];
      expect(call.where).toBeUndefined();
      expect(call.include).toEqual({ user: { select: { email: true, isActive: true } } });
    });

    it('scopes to the coach’s own roster for scope=own even on a dual-role admin', async () => {
      const dualRole: AuthenticatedUser = { userId: 'admin-1', email: 'a@x.com', role: 'ADMIN', isCoach: true };
      prisma.coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      await service.findAll(dualRole, 'own');
      expect(prisma.studentProfile.findMany.mock.calls[0][0].where).toEqual({
        coachLinks: { some: { coachId: 'coach-1' } }
      });
    });
  });

  describe('update', () => {
    it('404s on an unknown student', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(null);
      await expect(service.update('ghost', { firstName: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('persists the new homeAddress/priorExperience fields', async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'student-1' });
      await service.update('student-1', { homeAddress: '9 Riverside', priorExperience: 'Beginner' });
      expect(prisma.studentProfile.update).toHaveBeenCalledWith({
        where: { id: 'student-1' },
        data: expect.objectContaining({ homeAddress: '9 Riverside', priorExperience: 'Beginner' })
      });
    });
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
