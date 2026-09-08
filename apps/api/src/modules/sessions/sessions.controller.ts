import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { CancelSessionDto, CompleteSessionDto } from './dto/session-lifecycle.dto';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  // POST /api/v1/sessions — coach only; a free-form LOGGED session
  @Post()
  @UseGuards(RolesGuard)
  @Roles('COACH')
  create(@Body() dto: CreateSessionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.create(dto, user);
  }

  // GET /api/v1/sessions — admin sees all (or ?scope=own for their own if
  // they also coach); coach sees only their own. ?from / ?to (inclusive day
  // bounds) and ?status drive the calendar.
  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'COACH')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string
  ) {
    return this.sessionsService.findAll(user, { scope, from, to, status });
  }

  // GET /api/v1/sessions/:id — ownership enforced in the service
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.findOne(id, user);
  }

  // POST /api/v1/sessions/:id/complete — run a scheduled session: topic +
  // attendance. Coach-owner or admin.
  @Post(':id/complete')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'COACH')
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteSessionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.sessionsService.complete(id, dto, user);
  }

  // POST /api/v1/sessions/:id/cancel
  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'COACH')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelSessionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.sessionsService.cancel(id, dto, user);
  }
}
