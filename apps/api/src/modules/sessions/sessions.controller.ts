import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  // POST /api/v1/sessions — coach only
  @Post()
  @UseGuards(RolesGuard)
  @Roles('COACH')
  create(@Body() dto: CreateSessionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.create(dto, user);
  }

  // GET /api/v1/sessions — admin sees all (or, with ?scope=own, just their
  // own sessions if they're also a coach), coach sees only their own
  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'COACH')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('scope') scope?: string) {
    return this.sessionsService.findAll(user, scope);
  }

  // GET /api/v1/sessions/:id — ownership enforced in the service
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.findOne(id, user);
  }
}
