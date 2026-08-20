import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { StudentsModule } from './modules/students/students.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { PuzzlesModule } from './modules/puzzles/puzzles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    StudentsModule,
    SessionsModule,
    PuzzlesModule
  ]
})
export class AppModule {}