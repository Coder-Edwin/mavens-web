import { IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const TERM_STATUSES = ['PLANNED', 'ACTIVE', 'CLOSED'] as const;
export type TermStatus = (typeof TERM_STATUSES)[number];

export class CreateTermDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsOptional()
  @IsIn(TERM_STATUSES)
  status?: TermStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateTermDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsIn(TERM_STATUSES)
  status?: TermStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
