import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SchoolGroupsService } from './school-groups.service';
import { CreateSchoolGroupDto } from './dto/create-school-group.dto';
import { UpdateSchoolGroupDto } from './dto/update-school-group.dto';

// Partner-school batches. Admin-only throughout.
@Controller('school-groups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SchoolGroupsController {
  constructor(private readonly schoolGroupsService: SchoolGroupsService) {}

  @Post()
  create(@Body() dto: CreateSchoolGroupDto) {
    return this.schoolGroupsService.create(dto);
  }

  @Get()
  findAll(@Query('status') status?: string) {
    return this.schoolGroupsService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.schoolGroupsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSchoolGroupDto) {
    return this.schoolGroupsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.schoolGroupsService.remove(id);
  }
}
