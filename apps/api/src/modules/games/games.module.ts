import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GamesGateway } from './games.gateway';

@Module({
  imports: [AuthModule], // for JwtService (socket auth)
  controllers: [GamesController],
  providers: [GamesService, GamesGateway]
})
export class GamesModule {}
