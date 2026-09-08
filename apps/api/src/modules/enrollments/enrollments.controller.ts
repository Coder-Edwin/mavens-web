import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import {
  PauseEnrollmentDto,
  PlaceEnrollmentDto,
  ResumeEnrollmentDto,
  WaitlistEnrollmentDto,
  WithdrawEnrollmentDto
} from './dto/transition-enrollment.dto';

// The enrollment is the spine of a student's engagement with the club.
// Admin-only for now; coach/parent read views come with their portals.
@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  create(@Body() dto: CreateEnrollmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.enrollmentsService.create(dto, user.userId);
  }

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('deliveryType') deliveryType?: string,
    @Query('studentId') studentId?: string,
    @Query('schoolGroupId') schoolGroupId?: string
  ) {
    return this.enrollmentsService.findAll({ status, deliveryType, studentId, schoolGroupId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.enrollmentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEnrollmentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.enrollmentsService.update(id, dto, user.userId);
  }

  @Post(':id/place')
  place(
    @Param('id') id: string,
    @Body() dto: PlaceEnrollmentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.enrollmentsService.place(id, dto, user.userId);
  }

  @Post(':id/pause')
  pause(
    @Param('id') id: string,
    @Body() dto: PauseEnrollmentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.enrollmentsService.pause(id, dto, user.userId);
  }

  @Post(':id/resume')
  resume(
    @Param('id') id: string,
    @Body() dto: ResumeEnrollmentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.enrollmentsService.resume(id, dto, user.userId);
  }

  @Post(':id/withdraw')
  withdraw(
    @Param('id') id: string,
    @Body() dto: WithdrawEnrollmentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.enrollmentsService.withdraw(id, dto, user.userId);
  }

  @Post(':id/waitlist')
  waitlist(
    @Param('id') id: string,
    @Body() dto: WaitlistEnrollmentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.enrollmentsService.waitlist(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.enrollmentsService.remove(id);
  }
}
