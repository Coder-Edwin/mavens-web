import { IsString, MinLength } from 'class-validator';

export class RecordResultDto {
  @IsString()
  @MinLength(1)
  result!: string;
}
