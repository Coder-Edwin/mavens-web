import { Module } from '@nestjs/common';
import { SchoolGroupsController } from './school-groups.controller';
import { SchoolGroupsService } from './school-groups.service';

@Module({
  controllers: [SchoolGroupsController],
  providers: [SchoolGroupsService]
})
export class SchoolGroupsModule {}
