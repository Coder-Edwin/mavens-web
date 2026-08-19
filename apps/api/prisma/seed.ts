import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcrypt';

async function main() {
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  // CHANGE THIS PASSWORD after your first real login.
  const passwordHash = await bcrypt.hash('changeme123', 10);

  const amwai = await prisma.user.upsert({
    where: { email: 'amwai@mavenschessclub.com' },
    update: {},
    create: {
      email: 'amwai@mavenschessclub.com',
      passwordHash,
      role: 'ADMIN',
      isCoach: true,
      coachProfile: {
        create: {
          bio: 'Founder and head coach at Mavens Chess Club.'
        }
      }
    }
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded admin/coach account: ${amwai.email} (password: changeme123)`);

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
