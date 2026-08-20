import { IsDateString, IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class CreateTournamentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(1)
  venue!: string;

  @IsPositive()
  feeAmount!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;

  @IsOptional()
  @IsDateString()
  registrationDeadline?: string;
}
