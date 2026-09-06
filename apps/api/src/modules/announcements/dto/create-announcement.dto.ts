import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const AUDIENCES = ['ALL', 'PARENTS', 'STUDENTS', 'COACHES'] as const;
export type Audience = (typeof AUDIENCES)[number];

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsIn(AUDIENCES)
  audience?: Audience;
}
