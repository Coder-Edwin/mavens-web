import { IsIn, IsOptional } from 'class-validator';

export class CreateGameDto {
  @IsOptional()
  @IsIn(['white', 'black', 'random'])
  color?: 'white' | 'black' | 'random';
}
