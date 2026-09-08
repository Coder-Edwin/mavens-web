import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CoursesService } from './courses.service';
import { CreateLessonDto, UpdateLessonDto, UpdateModuleDto } from './dto/course.dto';

@Controller('course-modules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CourseModulesController {
  constructor(private readonly courses: CoursesService) {}

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateModuleDto) {
    return this.courses.updateModule(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.courses.removeModule(id);
  }

  @Post(':id/lessons')
  addLesson(@Param('id') id: string, @Body() dto: CreateLessonDto) {
    return this.courses.addLesson(id, dto);
  }
}

@Controller('course-lessons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourseLessonsController {
  constructor(private readonly courses: CoursesService) {}

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateLessonDto) {
    return this.courses.updateLesson(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.courses.removeLesson(id);
  }

  @Post(':id/complete')
  @Roles('STUDENT')
  complete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.courses.completeLesson(user, id);
  }

  @Delete(':id/complete')
  @Roles('STUDENT')
  uncomplete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.courses.uncompleteLesson(user, id);
  }
}

@Controller('course-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'COACH')
export class CourseAssignmentsController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  list(
    @Query('studentId') studentId?: string,
    @Query('courseId') courseId?: string,
    @Query('status') status?: string
  ) {
    return this.courses.listAssignments({ studentId, courseId, status });
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.courses.removeAssignment(id);
  }
}
