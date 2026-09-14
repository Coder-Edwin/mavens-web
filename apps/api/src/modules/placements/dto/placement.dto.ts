import { IsIn, IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export const STUDENT_LEVELS = ['NOVICE', 'INTERMEDIATE', 'ADVANCED'] as const;
export type StudentLevel = (typeof STUDENT_LEVELS)[number];

export const PLACEMENT_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

export class SchedulePlacementDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  enrollmentId?: string;

  @IsOptional()
  @IsISO8601()
  scheduledFor?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  assessorCoachId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdatePlacementDto {
  @IsOptional()
  @IsISO8601()
  scheduledFor?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  assessorCoachId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CompletePlacementDto {
  // Provide a rating (preferred — the level is derived from Amwai's bands:
  // Novice <1200, Intermediate 1200-1700, Advanced >1700) or an explicit
  // resultLevel. At least one is required; a rating wins if both are sent.
  @IsOptional()
  @IsIn(STUDENT_LEVELS)
  resultLevel?: StudentLevel;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(3200)
  rating?: number;

  @IsOptional()
  @IsISO8601()
  nextReviewDue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CancelPlacementDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
