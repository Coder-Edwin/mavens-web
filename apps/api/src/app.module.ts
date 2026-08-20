import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { StudentsModule } from './modules/students/students.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { PuzzlesModule } from './modules/puzzles/puzzles.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { MerchandiseModule } from './modules/merchandise/merchandise.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    StudentsModule,
    SessionsModule,
    PuzzlesModule,
    PaymentsModule,
    TournamentsModule,
    MerchandiseModule
  ]
})
export class AppModule {}