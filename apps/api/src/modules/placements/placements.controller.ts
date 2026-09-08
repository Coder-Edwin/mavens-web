import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PlacementsService } from './placements.service';
import {
  CancelPlacementDto,
  CompletePlacementDto,
  SchedulePlacementDto,
  UpdatePlacementDto
} from './dto/placement.dto';

@Controller('placements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PlacementsController {
  constructor(private readonly placementsService: PlacementsService) {}

  @Post()
  schedule(@Body() dto: SchedulePlacementDto) {
    return this.placementsService.schedule(dto);
  }

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('studentId') studentId?: string,
    @Query('dueBefore') dueBefore?: string
  ) {
    return this.placementsService.findAll({ status, studentId, dueBefore });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.placementsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlacementDto) {
    return this.placementsService.update(id, dto);
  }

  @Post(':id/complete')
  complete(
    @Param('id') id: string,
    @Body() dto: CompletePlacementDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.placementsService.complete(id, dto, user.userId);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelPlacementDto) {
    return this.placementsService.cancel(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.placementsService.remove(id);
  }
}
