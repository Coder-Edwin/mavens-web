import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClassroomController } from './classroom.controller';
import { ClassroomService } from './classroom.service';
import { ClassroomGateway } from './classroom.gateway';

@Module({
  imports: [AuthModule], // for JwtService (socket auth)
  controllers: [ClassroomController],
  providers: [ClassroomService, ClassroomGateway]
})
export class ClassroomModule {}
