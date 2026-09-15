import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RecordingSheetsService } from './recording-sheets.service';
import { CreateRecordingSheetDto, UpdateRecordingSheetDto } from './dto/recording-sheet.dto';

@Controller('recording-sheets')
@UseGuards(JwtAuthGuard)
export class RecordingSheetsController {
  constructor(private readonly service: RecordingSheetsService) {}

  // POST /api/v1/recording-sheets — any authenticated role may attempt it;
  // ownership (must be the student's coach, or admin) is enforced in the
  // service so a student/parent gets a clear 403 rather than a blanket 401.
  @Post()
  create(@Body() dto: CreateRecordingSheetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  // GET /api/v1/recording-sheets?studentId=... — required; scoped to one
  // student at a time (no club-wide browse yet). Ownership enforced in the service.
  @Get()
  findForStudent(@Query('studentId') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!studentId) throw new BadRequestException('studentId is required');
    return this.service.findForStudent(studentId, user);
  }

  // PATCH /api/v1/recording-sheets/:id — sets/updates the coach comment,
  // which is what "reviewing" a sheet means.
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRecordingSheetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user);
  }
}
