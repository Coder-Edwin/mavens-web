import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcrypt';

async function main() {
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  // ---------- Admin/coach ----------
  const passwordHash = await bcrypt.hash('changeme123', 10);

  const amwai = await prisma.user.upsert({
    where: { email: 'amwai@mavenschessclub.com' },
    update: {
      coachProfile: { update: { firstName: 'Tom', lastName: 'Amwai' } }
    },
    create: {
      email: 'amwai@mavenschessclub.com',
      passwordHash,
      role: 'ADMIN',
      isCoach: true,
      coachProfile: {
        create: {
          firstName: 'Tom',
          lastName: 'Amwai',
          bio: 'Founder and head coach at Mavens Chess Club.'
        }
      }
    }
  });
  // eslint-disable-next-line no-console
  console.log(`Seeded admin/coach account: ${amwai.email} (password: changeme123)`);

  // ---------- Plans: monthly class subscription + yearly club membership ----------
  const plans: { name: string; amount: number; billingCycle: 'MONTHLY' | 'YEARLY' }[] = [
    { name: 'Monthly Coaching', amount: 3500, billingCycle: 'MONTHLY' },
    { name: 'Annual Membership', amount: 6000, billingCycle: 'YEARLY' }
  ];
  for (const p of plans) {
    const existing = await prisma.subscriptionPlan.findFirst({
      where: { isActive: true, billingCycle: p.billingCycle }
    });
    if (existing) {
      // eslint-disable-next-line no-console
      console.log(`${p.billingCycle} plan already exists: ${existing.name}`);
      continue;
    }
    const created = await prisma.subscriptionPlan.create({ data: { ...p, isActive: true } });
    // eslint-disable-next-line no-console
    console.log(`Seeded ${p.billingCycle} plan: ${created.name} (KES ${created.amount})`);
  }

  // ---------- 2026 CBC terms (Amwai, Sept 2026) ----------
  // Kenya CBC term dates for 2026. International-curriculum schools vary
  // per school and aren't modeled here — these are the club's own terms.
  const terms: { name: string; startDate: Date; endDate: Date }[] = [
    { name: 'Term 1 2026', startDate: new Date('2026-01-05'), endDate: new Date('2026-04-02') },
    { name: 'Term 2 2026', startDate: new Date('2026-04-27'), endDate: new Date('2026-07-31') },
    { name: 'Term 3 2026', startDate: new Date('2026-08-24'), endDate: new Date('2026-10-23') }
  ];
  const today = new Date();
  for (const t of terms) {
    const existing = await prisma.term.findFirst({ where: { name: t.name } });
    if (existing) {
      // eslint-disable-next-line no-console
      console.log(`Term already exists: ${existing.name}`);
      continue;
    }
    const status = today < t.startDate ? 'PLANNED' : today > t.endDate ? 'CLOSED' : 'ACTIVE';
    const created = await prisma.term.create({ data: { ...t, status } });
    // eslint-disable-next-line no-console
    console.log(`Seeded term: ${created.name} (${created.status})`);
  }

  // ---------- Parent, linked to Faith ----------
  const parentPasswordHash = await bcrypt.hash('changeme123', 10);
  const parentUser = await prisma.user.upsert({
    where: { email: 'parent@example.com' },
    update: {},
    create: {
      email: 'parent@example.com',
      passwordHash: parentPasswordHash,
      role: 'PARENT',
      parentProfile: {
        create: { firstName: 'Grace', lastName: 'Wambui' }
      }
    },
    include: { parentProfile: true }
  });
  // eslint-disable-next-line no-console
  console.log(`Seeded parent account: ${parentUser.email} (password: changeme123)`);

  // Faith was created earlier through POST /students, not through this
  // seed script — so we look her up by email rather than a hardcoded ID.
  const faithUser = await prisma.user.findUnique({
    where: { email: 'faith@example.com' },
    include: { studentProfile: true }
  });

  if (faithUser?.studentProfile && parentUser.parentProfile) {
    await prisma.parentStudent.upsert({
      where: {
        parentId_studentId: {
          parentId: parentUser.parentProfile.id,
          studentId: faithUser.studentProfile.id
        }
      },
      update: {},
      create: {
        parentId: parentUser.parentProfile.id,
        studentId: faithUser.studentProfile.id
      }
    });
    // eslint-disable-next-line no-console
    console.log(`Linked parent ${parentUser.email} to student ${faithUser.email}`);
  } else {
    // eslint-disable-next-line no-console
    console.log('Skipped parent-student link: Faith not found yet (create her via POST /students first, then re-run this seed)');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});