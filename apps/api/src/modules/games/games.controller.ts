import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';

@Controller('games')
@UseGuards(JwtAuthGuard)
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  // POST /api/v1/games — open a new challenge (caller takes one seat)
  @Post()
  create(@Body() dto: CreateGameDto, @CurrentUser() user: AuthenticatedUser) {
    return this.gamesService.create(user.userId, dto.color ?? 'random');
  }

  // GET /api/v1/games — open challenges + the caller's own games
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.gamesService.listForUser(user.userId);
  }

  // GET /api/v1/games/:id — full game state
  @Get(':id')
  get(@Param('id') id: string) {
    return this.gamesService.get(id);
  }

  // POST /api/v1/games/:id/join — take the empty seat (PENDING -> ACTIVE)
  @Post(':id/join')
  join(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.gamesService.join(id, user.userId);
  }
}
