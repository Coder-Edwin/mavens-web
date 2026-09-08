import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { slugify } from '../articles/articles.service';
import {
  AssignCourseDto,
  COURSE_STATUSES,
  CreateCourseDto,
  CreateLessonDto,
  CreateModuleDto,
  STUDENT_LEVELS,
  UpdateCourseDto,
  UpdateLessonDto,
  UpdateModuleDto
} from './dto/course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly tree = {
    modules: {
      orderBy: { position: 'asc' as const },
      include: { lessons: { orderBy: { position: 'asc' as const } } }
    }
  };

  // ---------- Course ----------

  async createCourse(dto: CreateCourseDto, user: AuthenticatedUser) {
    return this.prisma.course.create({
      data: {
        slug: await this.uniqueSlug(slugify(dto.title)),
        title: dto.title.trim(),
        summary: dto.summary?.trim() || null,
        level: dto.level ?? null,
        status: dto.status ?? 'DRAFT',
        coverImageUrl: dto.coverImageUrl?.trim() || null,
        estimatedHours: dto.estimatedHours ?? null,
        createdById: user.userId
      },
      include: this.tree
    });
  }

  listCourses(filters: { status?: string; level?: string } = {}) {
    const where: Prisma.CourseWhereInput = {};
    if (filters.status && (COURSE_STATUSES as readonly string[]).includes(filters.status)) {
      where.status = filters.status as Prisma.CourseWhereInput['status'];
    }
    if (filters.level && (STUDENT_LEVELS as readonly string[]).includes(filters.level)) {
      where.level = filters.level as Prisma.CourseWhereInput['level'];
    }
    return this.prisma.course.findMany({
      where,
      orderBy: [{ status: 'asc' }, { title: 'asc' }],
      include: { _count: { select: { modules: true, assignments: true } } }
    });
  }

  async getCourse(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id }, include: this.tree });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async updateCourse(id: string, dto: UpdateCourseDto) {
    await this.loadCourse(id);
    return this.prisma.course.update({
      where: { id },
      data: {
        title: dto.title?.trim() ?? undefined,
        summary: dto.summary !== undefined ? dto.summary.trim() || null : undefined,
        level: dto.level !== undefined ? dto.level : undefined,
        status: dto.status ?? undefined,
        coverImageUrl:
          dto.coverImageUrl !== undefined ? dto.coverImageUrl.trim() || null : undefined,
        estimatedHours: dto.estimatedHours ?? undefined
      },
      include: this.tree
    });
  }

  async removeCourse(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { _count: { select: { assignments: true } } }
    });
    if (!course) throw new NotFoundException('Course not found');
    if (course._count.assignments > 0) {
      throw new BadRequestException(
        'This course has student assignments — set it to ARCHIVED instead of deleting it.'
      );
    }
    await this.prisma.course.delete({ where: { id } });
    return { id };
  }

  // ---------- Module ----------

  async addModule(courseId: string, dto: CreateModuleDto) {
    await this.loadCourse(courseId);
    const position = dto.position ?? (await this.nextPosition('courseModule', { courseId }));
    return this.prisma.courseModule.create({
      data: {
        courseId,
        title: dto.title.trim(),
        summary: dto.summary?.trim() || null,
        position
      },
      include: { lessons: { orderBy: { position: 'asc' } } }
    });
  }

  async updateModule(id: string, dto: UpdateModuleDto) {
    if (!(await this.prisma.courseModule.findUnique({ where: { id } }))) {
      throw new NotFoundException('Module not found');
    }
    return this.prisma.courseModule.update({
      where: { id },
      data: {
        title: dto.title?.trim() ?? undefined,
        summary: dto.summary !== undefined ? dto.summary.trim() || null : undefined,
        position: dto.position ?? undefined
      },
      include: { lessons: { orderBy: { position: 'asc' } } }
    });
  }

  async removeModule(id: string) {
    if (!(await this.prisma.courseModule.findUnique({ where: { id } }))) {
      throw new NotFoundException('Module not found');
    }
    await this.prisma.courseModule.delete({ where: { id } });
    return { id };
  }

  // ---------- Lesson ----------

  async addLesson(moduleId: string, dto: CreateLessonDto) {
    if (!(await this.prisma.courseModule.findUnique({ where: { id: moduleId } }))) {
      throw new NotFoundException('Module not found');
    }
    const position = dto.position ?? (await this.nextPosition('courseLesson', { moduleId }));
    return this.prisma.courseLesson.create({
      data: {
        moduleId,
        title: dto.title.trim(),
        body: dto.body,
        fen: dto.fen?.trim() || null,
        videoUrl: dto.videoUrl?.trim() || null,
        estimatedMinutes: dto.estimatedMinutes ?? null,
        position
      }
    });
  }

  async updateLesson(id: string, dto: UpdateLessonDto) {
    if (!(await this.prisma.courseLesson.findUnique({ where: { id } }))) {
      throw new NotFoundException('Lesson not found');
    }
    return this.prisma.courseLesson.update({
      where: { id },
      data: {
        title: dto.title?.trim() ?? undefined,
        body: dto.body ?? undefined,
        fen: dto.fen !== undefined ? dto.fen.trim() || null : undefined,
        videoUrl: dto.videoUrl !== undefined ? dto.videoUrl.trim() || null : undefined,
        estimatedMinutes: dto.estimatedMinutes ?? undefined,
        position: dto.position ?? undefined
      }
    });
  }

  async removeLesson(id: string) {
    if (!(await this.prisma.courseLesson.findUnique({ where: { id } }))) {
      throw new NotFoundException('Lesson not found');
    }
    await this.prisma.courseLesson.delete({ where: { id } });
    return { id };
  }

  // ---------- Assignments (admin/coach) ----------

  async assign(courseId: string, dto: AssignCourseDto, user: AuthenticatedUser) {
    const course = await this.loadCourse(courseId);
    if (course.status !== 'PUBLISHED') {
      throw new BadRequestException('Only a published course can be assigned');
    }
    const students = await this.prisma.studentProfile.findMany({
      where: { id: { in: dto.studentIds } },
      select: { id: true }
    });
    const known = new Set(students.map((s) => s.id));
    const unknown = dto.studentIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown student ids: ${unknown.join(', ')}`);
    }

    const existing = await this.prisma.courseAssignment.findMany({
      where: { courseId, studentId: { in: dto.studentIds } },
      select: { studentId: true }
    });
    const already = new Set(existing.map((e) => e.studentId));
    const toCreate = dto.studentIds.filter((id) => !already.has(id));

    if (toCreate.length > 0) {
      await this.prisma.courseAssignment.createMany({
        data: toCreate.map((studentId) => ({
          courseId,
          studentId,
          assignedById: user.userId,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null
        }))
      });
    }
    return { assigned: toCreate.length, skipped: already.size };
  }

  listAssignments(filters: { studentId?: string; courseId?: string; status?: string } = {}) {
    const where: Prisma.CourseAssignmentWhereInput = {};
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.status && ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(filters.status)) {
      where.status = filters.status as Prisma.CourseAssignmentWhereInput['status'];
    }
    return this.prisma.courseAssignment.findMany({
      where,
      orderBy: { assignedAt: 'desc' },
      include: {
        course: { select: { id: true, title: true, level: true } },
        student: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }

  async removeAssignment(id: string) {
    if (!(await this.prisma.courseAssignment.findUnique({ where: { id } }))) {
      throw new NotFoundException('Assignment not found');
    }
    await this.prisma.courseAssignment.delete({ where: { id } });
    return { id };
  }

  // ---------- Student-facing ----------

  async myCourses(user: AuthenticatedUser) {
    const student = await this.studentOrThrow(user);
    const assignments = await this.prisma.courseAssignment.findMany({
      where: { studentId: student.id },
      orderBy: { assignedAt: 'desc' },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            summary: true,
            level: true,
            coverImageUrl: true,
            _count: { select: { modules: true } }
          }
        }
      }
    });

    const results = [];
    for (const a of assignments) {
      const { total, done } = await this.progress(student.id, a.courseId);
      results.push({ ...a, progress: { total, done } });
    }
    return results;
  }

  async myCourse(user: AuthenticatedUser, courseId: string) {
    const student = await this.studentOrThrow(user);
    const assignment = await this.prisma.courseAssignment.findUnique({
      where: { courseId_studentId: { courseId, studentId: student.id } }
    });
    if (!assignment) throw new NotFoundException('This course is not assigned to you');

    const course = await this.prisma.course.findUnique({ where: { id: courseId }, include: this.tree });
    if (!course) throw new NotFoundException('Course not found');

    const completions = await this.prisma.lessonCompletion.findMany({
      where: { studentId: student.id, lesson: { module: { courseId } } },
      select: { lessonId: true }
    });

    return {
      assignment,
      course,
      completedLessonIds: completions.map((c) => c.lessonId)
    };
  }

  async completeLesson(user: AuthenticatedUser, lessonId: string) {
    const student = await this.studentOrThrow(user);
    const lesson = await this.prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true } } }
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const courseId = lesson.module.courseId;
    await this.assertAssigned(student.id, courseId);

    await this.prisma.lessonCompletion.upsert({
      where: { lessonId_studentId: { lessonId, studentId: student.id } },
      create: { lessonId, studentId: student.id },
      update: {}
    });
    return this.recomputeAssignment(student.id, courseId);
  }

  async uncompleteLesson(user: AuthenticatedUser, lessonId: string) {
    const student = await this.studentOrThrow(user);
    const lesson = await this.prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true } } }
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    await this.prisma.lessonCompletion.deleteMany({
      where: { lessonId, studentId: student.id }
    });
    return this.recomputeAssignment(student.id, lesson.module.courseId);
  }

  // ---------- helpers ----------

  private async loadCourse(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  private async studentOrThrow(user: AuthenticatedUser) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true }
    });
    if (!student) throw new NotFoundException('No student profile for this account');
    return student;
  }

  private async assertAssigned(studentId: string, courseId: string) {
    const a = await this.prisma.courseAssignment.findUnique({
      where: { courseId_studentId: { courseId, studentId } }
    });
    if (!a) throw new BadRequestException('This course is not assigned to you');
  }

  private async progress(studentId: string, courseId: string) {
    const total = await this.prisma.courseLesson.count({
      where: { module: { courseId } }
    });
    const done = await this.prisma.lessonCompletion.count({
      where: { studentId, lesson: { module: { courseId } } }
    });
    return { total, done };
  }

  private async recomputeAssignment(studentId: string, courseId: string) {
    const { total, done } = await this.progress(studentId, courseId);
    const status = done === 0 ? 'ASSIGNED' : total > 0 && done >= total ? 'COMPLETED' : 'IN_PROGRESS';

    const current = await this.prisma.courseAssignment.findUnique({
      where: { courseId_studentId: { courseId, studentId } }
    });
    return this.prisma.courseAssignment.update({
      where: { courseId_studentId: { courseId, studentId } },
      data: {
        status,
        startedAt: current?.startedAt ?? (status !== 'ASSIGNED' ? new Date() : null),
        completedAt: status === 'COMPLETED' ? (current?.completedAt ?? new Date()) : null
      }
    });
  }

  private async nextPosition(
    model: 'courseModule' | 'courseLesson',
    where: Record<string, string>
  ): Promise<number> {
    const agg =
      model === 'courseModule'
        ? await this.prisma.courseModule.aggregate({ where, _max: { position: true } })
        : await this.prisma.courseLesson.aggregate({ where, _max: { position: true } });
    return (agg._max.position ?? -1) + 1;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base;
    let n = 2;
    // eslint-disable-next-line no-await-in-loop
    while (await this.prisma.course.findUnique({ where: { slug: candidate } })) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    return candidate;
  }
}
