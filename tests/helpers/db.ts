import { prisma } from '../../src/infra/prisma.js';

export async function cleanDatabase(): Promise<void> {
  // Truncate tables with foreign key cascades
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE '_prisma%' AND tablename != 'session';
  `;

  for (const { tablename } of tablenames) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
