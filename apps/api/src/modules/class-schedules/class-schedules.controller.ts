import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClassSchedulesService } from './class-schedules.service';
import {
  CreateClassScheduleDto,
  GenerateSessionsDto,
  UpdateClassScheduleDto
} from './dto/class-schedule.dto';

@Controller('class-schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassSchedulesController {
  constructor(private readonly service: ClassSchedulesService) {}

  @Get()
  @Roles('ADMIN', 'COACH')
  findAll(
    @Query('status') status?: string,
    @Query('coachId') coachId?: string,
    @Query('termId') termId?: string,
    @Query('deliveryType') deliveryType?: string
  ) {
    return this.service.findAll({ status, coachId, termId, deliveryType });
  }

  @Get(':id')
  @Roles('ADMIN', 'COACH')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateClassScheduleDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateClassScheduleDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/generate')
  @Roles('ADMIN')
  generate(@Param('id') id: string, @Body() dto: GenerateSessionsDto) {
    return this.service.generate(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
