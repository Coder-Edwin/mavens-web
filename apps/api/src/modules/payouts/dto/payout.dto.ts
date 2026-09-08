import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class GeneratePayoutDto {
  @IsISO8601()
  periodStart!: string;

  @IsISO8601()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
