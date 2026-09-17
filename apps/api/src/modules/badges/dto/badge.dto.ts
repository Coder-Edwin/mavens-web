import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateBadgeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  // A single emoji (or short glyph) shown as the badge's icon.
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  icon!: string;

  // Free text describing what earns it — no automatic detection, an
  // admin/coach reads this and awards the badge by hand.
  @IsOptional()
  @IsString()
  @MaxLength(300)
  criteria?: string;
}

export class UpdateBadgeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  criteria?: string;
}

export class AwardBadgeDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  badgeId!: string;
}
