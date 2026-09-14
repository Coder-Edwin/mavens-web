import { IsDateString, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateStudentDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsUUID()
  coachId?: string; // CoachProfile.id — links this student to a coach immediately if provided

  // For HOME-delivery lessons.
  @IsOptional()
  @IsString()
  @MaxLength(300)
  homeAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  priorExperience?: string;
}
