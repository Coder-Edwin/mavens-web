import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClassroomRoomDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;
}

export class LoadClassroomPositionDto {
  // Either a PGN (with or without moves) or a bare FEN — exactly one.
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  pgn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fen?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label?: string;
}
