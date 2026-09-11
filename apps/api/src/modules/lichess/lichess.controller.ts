import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LichessService } from './lichess.service';

// Public lichess data, proxied so the browser doesn't need CORS/rate-limit
// handling of its own. Any signed-in club member can view it.
@Controller('lichess')
@UseGuards(JwtAuthGuard)
export class LichessController {
  constructor(private readonly lichess: LichessService) {}

  @Get('tv')
  tv() {
    return this.lichess.getTv();
  }

  @Get('game/:id/pgn')
  async gamePgn(@Param('id') id: string) {
    return { pgn: await this.lichess.getGamePgn(id) };
  }
}
