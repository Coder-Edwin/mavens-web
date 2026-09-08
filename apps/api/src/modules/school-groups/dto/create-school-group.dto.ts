import { IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export const SCHOOL_GROUP_STATUSES = ['PROSPECT', 'ACTIVE', 'INACTIVE'] as const;
export type SchoolGroupStatus = (typeof SCHOOL_GROUP_STATUSES)[number];

export class CreateSchoolGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  institutionName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  coordinatorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  coordinatorPhone?: string;

  @IsOptional()
  @IsEmail()
  coordinatorEmail?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  agreedGroupSize?: number;

  @IsOptional()
  @IsIn(SCHOOL_GROUP_STATUSES)
  status?: SchoolGroupStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
