import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PuzzlesService } from './puzzles.service';
import { CreatePuzzleSetDto } from './dto/create-puzzle-set.dto';

@Controller('puzzle-sets')
@UseGuards(JwtAuthGuard)
export class PuzzleSetsController {
  constructor(private readonly puzzlesService: PuzzlesService) {}

  // POST /api/v1/puzzle-sets — coach only
  @Post()
  @UseGuards(RolesGuard)
  @Roles('COACH')
  create(@Body() dto: CreatePuzzleSetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.puzzlesService.createSet(dto, user);
  }

  // GET /api/v1/puzzle-sets — admin sees all, coach sees their own
  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'COACH')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.puzzlesService.findAllSets(user);
  }
}
