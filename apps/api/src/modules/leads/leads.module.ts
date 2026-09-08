import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { PlacementsModule } from '../placements/placements.module';

@Module({
  imports: [EnrollmentsModule, PlacementsModule],
  controllers: [LeadsController],
  providers: [LeadsService]
})
export class LeadsModule {}
