import { Test, TestingModule } from '@nestjs/testing';
import { TournamentsService } from './tournaments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

describe('TournamentsService.myRegistrations', () => {
  let service: TournamentsService;
  let prisma: {
    studentProfile: { findUnique: jest.Mock };
    tournamentRegistration: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      studentProfile: { findUnique: jest.fn() },
      tournamentRegistration: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [TournamentsService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(TournamentsService);
  });

  afterEach(() => jest.clearAllMocks());

  const student: AuthenticatedUser = { userId: 'student-user-1', email: 's@x.com', role: 'STUDENT', isCoach: false };

  it('returns an empty list when the caller has no student profile', async () => {
    prisma.studentProfile.findUnique.mockResolvedValue(null);
    await expect(service.myRegistrations(student)).resolves.toEqual([]);
    expect(prisma.tournamentRegistration.findMany).not.toHaveBeenCalled();
  });

  it('lists the caller’s own registrations with the tournament joined', async () => {
    prisma.studentProfile.findUnique.mockResolvedValue({ id: 'stu-1' });
    await service.myRegistrations(student);
    expect(prisma.tournamentRegistration.findMany).toHaveBeenCalledWith({
      where: { studentId: 'stu-1' },
      include: { tournament: true },
      orderBy: { tournament: { date: 'asc' } }
    });
  });
});
