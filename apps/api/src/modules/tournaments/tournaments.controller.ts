import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { RegisterTournamentDto } from './dto/register-tournament.dto';
import { RecordResultDto } from './dto/record-result.dto';

@Controller('tournaments')
@UseGuards(JwtAuthGuard)
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  // POST /api/v1/tournaments — admin only
  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateTournamentDto) {
    return this.tournamentsService.create(dto);
  }

  // GET /api/v1/tournaments — any authenticated role
  @Get()
  findAll() {
    return this.tournamentsService.findAll();
  }

  // GET /api/v1/tournaments/:id — any authenticated role
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(id);
  }

  // POST /api/v1/tournaments/:id/register — student, parent, or admin;
  // WHICH student and ownership are both resolved inside the service
  @Post(':id/register')
  @UseGuards(RolesGuard)
  @Roles('STUDENT', 'PARENT', 'ADMIN')
  register(
    @Param('id') id: string,
    @Body() dto: RegisterTournamentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.tournamentsService.register(id, dto, user);
  }

  // PATCH /api/v1/tournaments/:id/registrations/:registrationId/result — admin only
  @Patch(':id/registrations/:registrationId/result')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  recordResult(
    @Param('id') id: string,
    @Param('registrationId') registrationId: string,
    @Body() dto: RecordResultDto
  ) {
    return this.tournamentsService.recordResult(id, registrationId, dto);
  }
}
