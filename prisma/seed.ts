import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/infra/prisma.js';

export const SEED_USERS = [
  {
    email: 'jefe@sgec.local',
    name: 'Jefe de Oficina',
    role: UserRole.OFFICE_HEAD,
  },
  {
    email: 'auxiliar@sgec.local',
    name: 'Auxiliar Administrativo',
    role: UserRole.ADMIN_ASSISTANT,
  },
  {
    email: 'juridica@sgec.local',
    name: 'Abogado Jurídico',
    role: UserRole.LEGAL,
  },
  {
    email: 'secretario@sgec.local',
    name: 'Secretario de Cultura',
    role: UserRole.SECRETARY,
  },
  {
    email: 'operativo@sgec.local',
    name: 'Técnico Operativo',
    role: UserRole.OPERATIONS_TECH,
  },
  {
    email: 'mantenimiento@sgec.local',
    name: 'Técnico de Mantenimiento',
    role: UserRole.MAINTENANCE_TECH,
  },
];

export async function seedUsers(): Promise<void> {
  const passwordHash = await bcrypt.hash('Cambiar123!', 10);

  for (const user of SEED_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        passwordHash,
        active: true,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
        active: true,
      },
    });
  }
}

async function main() {
  console.info('🌱 Starting SGEC database seeding...');
  await seedUsers();
  console.info(`✅ Seeded ${SEED_USERS.length} system users successfully.`);
}

if (process.argv[1]?.endsWith('seed.ts')) {
  main()
    .catch((e) => {
      console.error('❌ Seeding error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
