import { IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
  @IsIn(STUDENT_LEVELS)
  resultLevel!: StudentLevel;

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
