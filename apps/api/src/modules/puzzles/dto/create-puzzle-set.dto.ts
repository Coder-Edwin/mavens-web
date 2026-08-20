import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePuzzleSetDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  difficulty?: string;
}
