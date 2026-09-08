import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import {
  CourseAssignmentsController,
  CourseLessonsController,
  CourseModulesController
} from './course-parts.controller';
import { CoursesService } from './courses.service';

@Module({
  controllers: [
    CoursesController,
    CourseModulesController,
    CourseLessonsController,
    CourseAssignmentsController
  ],
  providers: [CoursesService]
})
export class CoursesModule {}
