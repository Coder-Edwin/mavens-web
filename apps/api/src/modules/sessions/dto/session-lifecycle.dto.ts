import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CompleteSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  presentStudentIds!: string[];
}

export class CancelSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
