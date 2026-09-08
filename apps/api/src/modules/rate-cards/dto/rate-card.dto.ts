import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

export const DELIVERY_TYPES = ['HOME', 'CENTER', 'SCHOOL_GROUP'] as const;
export const STUDENT_LEVELS = ['NOVICE', 'INTERMEDIATE', 'ADVANCED'] as const;
export const CLIENT_TYPES = ['INDIVIDUAL', 'INSTITUTION'] as const;
export const RATE_UNITS = ['PER_SESSION', 'PER_MONTH', 'PER_TERM'] as const;

export class CreateRateCardDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsIn(DELIVERY_TYPES)
  deliveryType!: (typeof DELIVERY_TYPES)[number];

  @IsOptional()
  @IsIn(STUDENT_LEVELS)
  level?: (typeof STUDENT_LEVELS)[number];

  @IsOptional()
  @IsIn(CLIENT_TYPES)
  clientType?: (typeof CLIENT_TYPES)[number];

  @IsOptional()
  @IsIn(RATE_UNITS)
  unit?: (typeof RATE_UNITS)[number];

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateRateCardDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(DELIVERY_TYPES)
  deliveryType?: (typeof DELIVERY_TYPES)[number];

  // `null` clears the field; class-validator's @IsOptional() lets null past
  // @IsIn, and the service maps `null` -> Prisma `null`.
  @IsOptional()
  @IsIn(STUDENT_LEVELS)
  level?: (typeof STUDENT_LEVELS)[number] | null;

  @IsOptional()
  @IsIn(CLIENT_TYPES)
  clientType?: (typeof CLIENT_TYPES)[number] | null;

  @IsOptional()
  @IsIn(RATE_UNITS)
  unit?: (typeof RATE_UNITS)[number];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
