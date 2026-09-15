import { Module } from '@nestjs/common';
import { RecordingSheetsController } from './recording-sheets.controller';
import { RecordingSheetsService } from './recording-sheets.service';

@Module({
  controllers: [RecordingSheetsController],
  providers: [RecordingSheetsService]
})
export class RecordingSheetsModule {}
