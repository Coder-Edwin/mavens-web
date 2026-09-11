import { Module } from '@nestjs/common';
import { LichessController } from './lichess.controller';
import { LichessService } from './lichess.service';

@Module({
  controllers: [LichessController],
  providers: [LichessService]
})
export class LichessModule {}
