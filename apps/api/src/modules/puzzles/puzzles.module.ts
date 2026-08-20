import { Module } from '@nestjs/common';
import { PuzzleSetsController } from './puzzle-sets.controller';
import { PuzzleAssignmentsController } from './puzzle-assignments.controller';
import { PuzzlesService } from './puzzles.service';

@Module({
  controllers: [PuzzleSetsController, PuzzleAssignmentsController],
  providers: [PuzzlesService]
})
export class PuzzlesModule {}
