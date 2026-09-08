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
import { ArticlesModule } from './modules/articles/articles.module';
import { LeadsModule } from './modules/leads/leads.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { GamesModule } from './modules/games/games.module';
import { SchoolGroupsModule } from './modules/school-groups/school-groups.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { PlacementsModule } from './modules/placements/placements.module';
import { CoachesModule } from './modules/coaches/coaches.module';
import { TermsModule } from './modules/terms/terms.module';
import { ClassSchedulesModule } from './modules/class-schedules/class-schedules.module';
import { RateCardsModule } from './modules/rate-cards/rate-cards.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { CoursesModule } from './modules/courses/courses.module';

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
    MerchandiseModule,
    ArticlesModule,
    LeadsModule,
    AnnouncementsModule,
    GamesModule,
    SchoolGroupsModule,
    EnrollmentsModule,
    PlacementsModule,
    CoachesModule,
    TermsModule,
    ClassSchedulesModule,
    RateCardsModule,
    InvoicesModule,
    PayoutsModule,
    CoursesModule
  ]
})
export class AppModule {}