import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AUDIENCES, type Audience } from './create-announcement.dto';

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsIn(AUDIENCES)
  audience?: Audience;
}
