import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/// Prisma 7 requires a driver adapter for PrismaClient at runtime — this is
/// separate from prisma.config.ts, which only covers the CLI/migrations.
/// Every service in the app injects THIS class rather than importing
/// PrismaClient directly, so the connection lifecycle stays in one place.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
