import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateRecordingSheetDto, UpdateRecordingSheetDto } from './dto/recording-sheet.dto';

/// A photographed paper scoresheet from an OTB game, filed against a
/// student for a coach to review. No file-upload pipeline exists in this
/// app yet — imageUrl is a plain link to wherever the photo is already
/// hosted (WhatsApp/Drive/etc.), same convention as MerchandiseItem.imageUrl.
@Injectable()
export class RecordingSheetsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    reviewedBy: { select: { firstName: true, lastName: true } }
  } as const;

  /// Ownership check shared by list/create/update: can `currentUser` act on
  /// sheets for `studentId`? Admin: always. Coach: only an assigned
  /// student, for read or write. Parent: only a linked child, read-only.
  /// Student: only themselves, read-only. (`forWrite` is a defense-in-depth
  /// backstop — the controller already restricts create/update to
  /// ADMIN/COACH — so a student/parent can never actually reach it.)
  private async assertCanAccessStudent(studentId: string, currentUser: AuthenticatedUser, forWrite = false) {
    if (currentUser.role === 'ADMIN') return;

    if (currentUser.role === 'COACH') {
      const coach = await this.prisma.coachProfile.findUnique({ where: { userId: currentUser.userId } });
      const linked =
        coach &&
        (await this.prisma.coachStudent.findUnique({
          where: { coachId_studentId: { coachId: coach.id, studentId } }
        }));
      if (linked) return;
      throw new ForbiddenException("You are not this student's coach");
    }

    if (forWrite) throw new ForbiddenException('Only a coach or admin can do this');

    if (currentUser.role === 'STUDENT') {
      const student = await this.prisma.studentProfile.findUnique({ where: { userId: currentUser.userId } });
      if (student && student.id === studentId) return;
      throw new ForbiddenException('You can only view your own recording sheets');
    }

    if (currentUser.role === 'PARENT') {
      const parent = await this.prisma.parentProfile.findUnique({ where: { userId: currentUser.userId } });
      const linked =
        parent &&
        (await this.prisma.parentStudent.findUnique({
          where: { parentId_studentId: { parentId: parent.id, studentId } }
        }));
      if (linked) return;
      throw new ForbiddenException('You are not linked to this student');
    }

    throw new ForbiddenException('You do not have permission to view these recording sheets');
  }

  async create(dto: CreateRecordingSheetDto, currentUser: AuthenticatedUser) {
    const student = await this.prisma.studentProfile.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Student not found');
    await this.assertCanAccessStudent(dto.studentId, currentUser, true);

    return this.prisma.recordingSheet.create({
      data: {
        studentId: dto.studentId,
        imageUrl: dto.imageUrl.trim(),
        coachComment: dto.coachComment?.trim() || null
      },
      include: this.include
    });
  }

  async findForStudent(studentId: string, currentUser: AuthenticatedUser) {
    await this.assertCanAccessStudent(studentId, currentUser);
    return this.prisma.recordingSheet.findMany({
      where: { studentId },
      orderBy: { uploadedAt: 'desc' },
      include: this.include
    });
  }

  /// Setting coachComment is what "reviewing" a sheet means — it stamps the
  /// reviewing coach and timestamp alongside it.
  async update(id: string, dto: UpdateRecordingSheetDto, currentUser: AuthenticatedUser) {
    const sheet = await this.prisma.recordingSheet.findUnique({ where: { id } });
    if (!sheet) throw new NotFoundException('Recording sheet not found');
    await this.assertCanAccessStudent(sheet.studentId, currentUser, true);

    let reviewedById: string | null = null;
    if (currentUser.role === 'COACH' || currentUser.isCoach) {
      const coach = await this.prisma.coachProfile.findUnique({ where: { userId: currentUser.userId } });
      reviewedById = coach?.id ?? null;
    }

    return this.prisma.recordingSheet.update({
      where: { id },
      data: {
        coachComment: dto.coachComment.trim(),
        ...(reviewedById ? { reviewedById, reviewedAt: new Date() } : {})
      },
      include: this.include
    });
  }

  async remove(id: string, currentUser: AuthenticatedUser) {
    if (currentUser.role !== 'ADMIN') {
      throw new ForbiddenException('Only an admin can delete a recording sheet');
    }
    const sheet = await this.prisma.recordingSheet.findUnique({ where: { id } });
    if (!sheet) throw new NotFoundException('Recording sheet not found');
    await this.prisma.recordingSheet.delete({ where: { id } });
    return { id };
  }
}
