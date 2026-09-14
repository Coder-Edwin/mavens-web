import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentRating?: number;

  // For HOME-delivery lessons. `level` is deliberately not editable here —
  // it's derived from a placement assessment (see PlacementsService.complete).
  @IsOptional()
  @IsString()
  @MaxLength(300)
  homeAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  priorExperience?: string;
}
