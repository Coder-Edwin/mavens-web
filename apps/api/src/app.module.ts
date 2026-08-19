import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule
    // Future modules land here: StudentsModule, CoachesModule, SessionsModule,
    // PuzzlesModule, PaymentsModule, TournamentsModule, MerchandiseModule...
  ]
})
export class AppModule {}
