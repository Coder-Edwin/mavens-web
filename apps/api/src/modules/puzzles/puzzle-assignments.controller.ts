import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PuzzlesService } from './puzzles.service';
import { CreatePuzzleAssignmentDto } from './dto/create-puzzle-assignment.dto';
import { GradePuzzleDto } from './dto/grade-puzzle.dto';

@Controller('puzzle-assignments')
@UseGuards(JwtAuthGuard)
export class PuzzleAssignmentsController {
  constructor(private readonly puzzlesService: PuzzlesService) {}

  // POST /api/v1/puzzle-assignments — coach only, ownership-checked per student
  @Post()
  @UseGuards(RolesGuard)
  @Roles('COACH')
  assign(@Body() dto: CreatePuzzleAssignmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.puzzlesService.assign(dto, user);
  }

  // GET /api/v1/puzzle-assignments — role-scoped inside the service
  // (admin: all, coach: assigned by them, student: assigned to them)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.puzzlesService.findAllAssignments(user);
  }

  // GET /api/v1/puzzle-assignments/:id — ownership enforced in the service
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.puzzlesService.findOneAssignment(id, user);
  }

  // POST /api/v1/puzzle-assignments/:id/submit — student only, must own the assignment
  @Post(':id/submit')
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  submit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.puzzlesService.submit(id, user);
  }

  // PATCH /api/v1/puzzle-assignments/:id/grade — coach only, must own the assignment
  @Patch(':id/grade')
  @UseGuards(RolesGuard)
  @Roles('COACH')
  grade(@Param('id') id: string, @Body() dto: GradePuzzleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.puzzlesService.grade(id, dto, user);
  }
}
