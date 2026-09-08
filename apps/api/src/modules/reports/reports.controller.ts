import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  overview() {
    return this.reports.overview();
  }

  @Get('revenue')
  revenue(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.revenue(from, to);
  }

  @Get('coach-activity')
  coachActivity(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.coachActivity(from, to);
  }

  @Get('enrollment-funnel')
  funnel() {
    return this.reports.enrollmentFunnel();
  }

  @Get('students.csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="students.csv"')
  studentsCsv() {
    return this.reports.studentsCsv();
  }

  @Get('enrollments.csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="enrollments.csv"')
  enrollmentsCsv() {
    return this.reports.enrollmentsCsv();
  }

  @Get('attendance.csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="attendance.csv"')
  attendanceCsv(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.attendanceCsv(from, to);
  }
}
