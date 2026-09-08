import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';

const DELIVERY_TYPES = ['HOME', 'CENTER', 'SCHOOL_GROUP'] as const;
const STUDENT_LEVELS = ['NOVICE', 'INTERMEDIATE', 'ADVANCED'] as const;

// Turns a triaged lead into a real student record. The admin fills in the
// details the public form never collected (the student's own login, DOB) and
// decides whether to open an enrollment and book a placement in the same step.
export class ConvertLeadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  studentFirstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  studentLastName!: string;

  @IsEmail()
  studentEmail!: string;

  @IsOptional()
  @IsISO8601()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  homeAddress?: string;

  @IsOptional()
  @IsIn(STUDENT_LEVELS)
  level?: (typeof STUDENT_LEVELS)[number];

  // Create/link a ParentProfile from the lead's contact details. Default true.
  @IsOptional()
  @IsBoolean()
  linkParent?: boolean;

  @IsOptional()
  @IsBoolean()
  createEnrollment?: boolean;

  @IsOptional()
  @IsIn(DELIVERY_TYPES)
  deliveryType?: (typeof DELIVERY_TYPES)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  schoolGroupId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  assignedCoachId?: string;

  @IsOptional()
  @IsBoolean()
  schedulePlacement?: boolean;

  @IsOptional()
  @IsISO8601()
  placementScheduledFor?: string;
}
