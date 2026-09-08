import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CoursesService } from './courses.service';
import {
  AssignCourseDto,
  CreateCourseDto,
  CreateModuleDto,
  UpdateCourseDto
} from './dto/course.dto';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  // ---- student portal (declared first so "mine" isn't taken as an :id) ----

  @Get('mine')
  @Roles('STUDENT')
  myCourses(@CurrentUser() user: AuthenticatedUser) {
    return this.courses.myCourses(user);
  }

  @Get('mine/:courseId')
  @Roles('STUDENT')
  myCourse(@CurrentUser() user: AuthenticatedUser, @Param('courseId') courseId: string) {
    return this.courses.myCourse(user, courseId);
  }

  // ---- catalog: admin manages, coach can read ----

  @Get()
  @Roles('ADMIN', 'COACH')
  list(@Query('status') status?: string, @Query('level') level?: string) {
    return this.courses.listCourses({ status, level });
  }

  @Get(':id')
  @Roles('ADMIN', 'COACH')
  get(@Param('id') id: string) {
    return this.courses.getCourse(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateCourseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.courses.createCourse(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.courses.updateCourse(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.courses.removeCourse(id);
  }

  @Post(':id/modules')
  @Roles('ADMIN')
  addModule(@Param('id') id: string, @Body() dto: CreateModuleDto) {
    return this.courses.addModule(id, dto);
  }

  @Post(':id/assign')
  @Roles('ADMIN')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignCourseDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.courses.assign(id, dto, user);
  }
}
