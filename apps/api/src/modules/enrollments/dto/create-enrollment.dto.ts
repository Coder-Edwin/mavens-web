import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';

export const DELIVERY_TYPES = ['HOME', 'CENTER', 'SCHOOL_GROUP'] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

export const STUDENT_LEVELS = ['NOVICE', 'INTERMEDIATE', 'ADVANCED'] as const;
export type StudentLevel = (typeof STUDENT_LEVELS)[number];

export const ENROLLMENT_STATUSES = [
  'PENDING_PLACEMENT',
  'WAITLISTED',
  'ACTIVE',
  'PAUSED',
  'WITHDRAWN'
] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export class CreateEnrollmentDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsIn(DELIVERY_TYPES)
  deliveryType!: DeliveryType;

  // Required by the service when deliveryType is SCHOOL_GROUP; ignored otherwise.
  @IsOptional()
  @IsString()
  @MinLength(1)
  schoolGroupId?: string;

  // If supplied on creation the enrollment is placed straight away (transfer-in),
  // unless `waitlisted` is also set.
  @IsOptional()
  @IsIn(STUDENT_LEVELS)
  level?: StudentLevel;

  @IsOptional()
  @IsString()
  @MinLength(1)
  assignedCoachId?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsBoolean()
  waitlisted?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
