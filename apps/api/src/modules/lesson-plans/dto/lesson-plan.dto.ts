import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLessonPlanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  objectives?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  materialUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  difficulty?: string;
}

export class UpdateLessonPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  objectives?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  materialUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  difficulty?: string;
}
