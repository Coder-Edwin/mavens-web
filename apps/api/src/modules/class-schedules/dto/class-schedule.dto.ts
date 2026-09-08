import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

export const DELIVERY_TYPES = ['HOME', 'CENTER', 'SCHOOL_GROUP'] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

export const STUDENT_LEVELS = ['NOVICE', 'INTERMEDIATE', 'ADVANCED'] as const;
export type StudentLevel = (typeof STUDENT_LEVELS)[number];

export const SCHEDULE_STATUSES = ['ACTIVE', 'PAUSED', 'ENDED'] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateClassScheduleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsIn(DELIVERY_TYPES)
  deliveryType!: DeliveryType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  schoolGroupId?: string;

  @IsOptional()
  @IsIn(STUDENT_LEVELS)
  level?: StudentLevel;

  @IsOptional()
  @IsString()
  @MinLength(1)
  coachId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  venue?: string;

  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number; // 0 = Sunday .. 6 = Saturday

  @Matches(HHMM, { message: 'startTime must be HH:MM (24-hour)' })
  startTime!: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  termId?: string;

  @IsISO8601()
  startDate!: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsIn(SCHEDULE_STATUSES)
  status?: ScheduleStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateClassScheduleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsIn(DELIVERY_TYPES)
  deliveryType?: DeliveryType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  schoolGroupId?: string;

  @IsOptional()
  @IsIn(STUDENT_LEVELS)
  level?: StudentLevel;

  @IsOptional()
  @IsString()
  @MinLength(1)
  coachId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  venue?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  @IsOptional()
  @Matches(HHMM, { message: 'startTime must be HH:MM (24-hour)' })
  startTime?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  termId?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsIn(SCHEDULE_STATUSES)
  status?: ScheduleStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class GenerateSessionsDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
