import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Controller('announcements')
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  // GET /api/v1/announcements/feed — any signed-in user; their group's broadcasts.
  // Declared before the admin list so "feed" isn't a problem if a param route
  // is added later.
  @Get('feed')
  feed(@CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.feedFor(user);
  }

  // GET /api/v1/announcements — admin only, full history
  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  findAll() {
    return this.announcementsService.findAllForAdmin();
  }

  // POST /api/v1/announcements — admin only
  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.create(dto, user);
  }

  // PATCH /api/v1/announcements/:id — admin only
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcementsService.update(id, dto);
  }

  // DELETE /api/v1/announcements/:id — admin only
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.announcementsService.remove(id);
  }
}
