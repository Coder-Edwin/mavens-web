import { ArrayNotEmpty, IsArray, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreatePuzzleAssignmentDto {
  @IsUUID()
  puzzleSetId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  studentIds!: string[]; // one PuzzleAssignment row gets created per student

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
