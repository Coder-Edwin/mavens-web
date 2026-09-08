import { IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { STUDENT_LEVELS, type StudentLevel } from './create-enrollment.dto';

export class PlaceEnrollmentDto {
  @IsIn(STUDENT_LEVELS)
  level!: StudentLevel;

  @IsOptional()
  @IsString()
  @MinLength(1)
  assignedCoachId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class PauseEnrollmentDto {
  @IsOptional()
  @IsISO8601()
  pausedFrom?: string;

  @IsOptional()
  @IsISO8601()
  pausedTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class WithdrawEnrollmentDto {
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class WaitlistEnrollmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ResumeEnrollmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
