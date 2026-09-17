import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { BadgesService } from './badges.service';
import { AwardBadgeDto, CreateBadgeDto, UpdateBadgeDto } from './dto/badge.dto';

@Controller('badges')
@UseGuards(JwtAuthGuard)
export class BadgesController {
  constructor(private readonly service: BadgesService) {}

  // GET /api/v1/badges — the whole catalog; any authenticated role (used by
  // the award-a-badge picker and by anyone browsing what's available).
  @Get()
  listBadges() {
    return this.service.listBadges();
  }

  // POST /api/v1/badges — admin only (badges are a club-wide catalog).
  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  createBadge(@Body() dto: CreateBadgeDto) {
    return this.service.createBadge(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateBadge(@Param('id') id: string, @Body() dto: UpdateBadgeDto) {
    return this.service.updateBadge(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  removeBadge(@Param('id') id: string) {
    return this.service.removeBadge(id);
  }

  // POST /api/v1/badges/award — admin, or a coach for their own student.
  @Post('award')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'COACH')
  award(@Body() dto: AwardBadgeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.award(dto, user);
  }

  @Delete(':badgeId/students/:studentId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'COACH')
  revoke(
    @Param('badgeId') badgeId: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.revoke(studentId, badgeId, user);
  }

  // GET /api/v1/badges/mine — a student's own earned badges, no id needed.
  // Declared before 'students/:studentId' — not required for correctness
  // (different literal first segment) but keeps the two "whose badges"
  // routes together for readability.
  @Get('mine')
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.myBadges(user);
  }

  // GET /api/v1/badges/students/:studentId — a student's earned badges.
  // Ownership enforced in the service.
  @Get('students/:studentId')
  listForStudent(@Param('studentId') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listForStudent(studentId, user);
  }
}
