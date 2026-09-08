import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength
} from 'class-validator';
import { PAIRING_RESULTS } from '../swiss';

export class UpdateTournamentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  venue?: string;

  @IsOptional()
  @IsPositive()
  feeAmount?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalRounds?: number;

  @IsOptional()
  @IsDateString()
  registrationDeadline?: string;
}

export class RecordPairingResultDto {
  @IsIn(PAIRING_RESULTS)
  result!: (typeof PAIRING_RESULTS)[number];
}

export class UpdateRegistrationDto {
  @IsOptional()
  @IsBoolean()
  withdrawn?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  seed?: number;
}
