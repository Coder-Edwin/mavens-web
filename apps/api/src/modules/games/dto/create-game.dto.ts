import { IsIn, IsOptional } from 'class-validator';
import { TIME_CONTROLS } from '../games.service';

export class CreateGameDto {
  @IsOptional()
  @IsIn(['white', 'black', 'random'])
  color?: 'white' | 'black' | 'random';

  // Per-side clock in seconds; omit for an untimed game.
  @IsOptional()
  @IsIn(TIME_CONTROLS as unknown as number[])
  initialSeconds?: number;
}
