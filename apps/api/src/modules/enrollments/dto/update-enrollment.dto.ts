import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DELIVERY_TYPES, STUDENT_LEVELS, type DeliveryType, type StudentLevel } from './create-enrollment.dto';

// General-purpose edits to an enrollment's placement details. Status changes go
// through the dedicated place/pause/resume/withdraw/waitlist endpoints instead.
export class UpdateEnrollmentDto {
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
  assignedCoachId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
