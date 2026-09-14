import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ClassroomService } from './classroom.service';
import { ClassroomGateway } from './classroom.gateway';
import { CreateClassroomRoomDto, LoadClassroomPositionDto } from './dto/classroom.dto';

@Controller('classroom')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassroomController {
  constructor(
    private readonly classroomService: ClassroomService,
    private readonly gateway: ClassroomGateway
  ) {}

  // POST /api/v1/classroom — host a new room. Coaches/admins only; anyone
  // with the resulting code can join.
  @Post()
  @Roles('ADMIN', 'COACH')
  create(@Body() dto: CreateClassroomRoomDto, @CurrentUser() user: AuthenticatedUser) {
    return this.classroomService.create(user.userId, dto);
  }

  // GET /api/v1/classroom/code/:code — resolve a room code to its id, to
  // join. Declared before ':id' so "code" isn't captured as an id.
  @Get('code/:code')
  getByCode(@Param('code') code: string) {
    return this.classroomService.getByCode(code);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.classroomService.get(id);
  }

  @Post(':id/close')
  async close(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const room = await this.classroomService.close(id, user.userId);
    this.gateway.broadcastClosed(id);
    return room;
  }

  // Loading a position / picking from the library / resetting can also
  // happen over the socket (classroom:load etc.) — these REST mirrors exist
  // so the same actions work from a plain fetch if a socket hiccups.
  @Post(':id/load')
  async load(@Param('id') id: string, @Body() dto: LoadClassroomPositionDto) {
    const { room, entry } = await this.classroomService.loadPosition(id, dto);
    this.gateway.broadcastState(id, room, { type: 'loaded', entry });
    return room;
  }

  @Post(':id/library/:entryId/select')
  async select(@Param('id') id: string, @Param('entryId') entryId: string) {
    const room = await this.classroomService.selectFromLibrary(id, entryId);
    this.gateway.broadcastState(id, room, { type: 'selected', entryId });
    return room;
  }

  @Delete(':id/library/:entryId')
  async removeFromLibrary(@Param('id') id: string, @Param('entryId') entryId: string) {
    const room = await this.classroomService.removeFromLibrary(id, entryId);
    this.gateway.broadcastState(id, room, { type: 'library' });
    return room;
  }

  @Post(':id/reset')
  async reset(@Param('id') id: string) {
    const room = await this.classroomService.reset(id);
    this.gateway.broadcastState(id, room, { type: 'reset' });
    return room;
  }
}
