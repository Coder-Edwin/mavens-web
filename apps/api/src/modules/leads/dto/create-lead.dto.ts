import { IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/// Public payload from the "join the club" form. Kept deliberately small —
/// enough for a coach to follow up, nothing sensitive.
export class CreateLeadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  parentName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  childName?: string;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(21)
  childAge?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
