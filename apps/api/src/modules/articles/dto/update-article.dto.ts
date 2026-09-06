import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  // Omit to leave the cover image alone; send null to clear it; send a
  // string to set it. @IsOptional() lets null through (validators are
  // skipped for null/undefined).
  @IsOptional()
  @IsString()
  coverImageUrl?: string | null;

  // Flipping to PUBLISHED stamps publishedAt (if not already set); flipping
  // back to DRAFT hides it from the public again but keeps the timestamp.
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED'])
  status?: 'DRAFT' | 'PUBLISHED';
}
