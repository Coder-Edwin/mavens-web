import { ArrayNotEmpty, IsArray, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  topic!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  groupName?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  presentStudentIds!: string[]; // StudentProfile ids who attended this session
}
