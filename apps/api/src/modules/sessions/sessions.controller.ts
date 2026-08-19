import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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

  // POST /api/v1/sessions — coach only (Amwai qualifies via isCoach, no need to list ADMIN)
  @Post()
  @UseGuards(RolesGuard)
  @Roles('COACH')
  create(@Body() dto: CreateSessionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.create(dto, user);
  }

  // GET /api/v1/sessions — admin sees all, coach sees only their own
  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'COACH')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.findAll(user);
  }

  // GET /api/v1/sessions/:id — ownership enforced in the service
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.findOne(id, user);
  }
}
