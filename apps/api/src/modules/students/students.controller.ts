import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Controller('students')
@UseGuards(JwtAuthGuard) // every route here requires login; RolesGuard is added per-route below
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  // POST /api/v1/students — admin only
  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  // GET /api/v1/students — admin sees everyone, coach sees only their own students
  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'COACH')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.findAll(user);
  }

  // GET /api/v1/students/:id — any authenticated role; ownership enforced in the service
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.findOne(id, user);
  }

  // PATCH /api/v1/students/:id — admin only for now
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(id, dto);
  }
}
