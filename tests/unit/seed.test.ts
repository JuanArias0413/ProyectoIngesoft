import { describe, it, expect } from 'vitest';
import { prisma } from '../../src/infra/prisma.js';
import { seedUsers, SEED_USERS } from '../../prisma/seed.js';
import { verifyPassword } from '../../src/modules/auth/password.js';

describe('Database Seed Idempotency', () => {
  it('seeds 6 system users without throwing', async () => {
    await seedUsers();
    const count = await prisma.user.count({
      where: {
        email: { in: SEED_USERS.map((u) => u.email) },
      },
    });
    expect(count).toBe(6);
  });

  it('running seed again does not duplicate users (idempotency)', async () => {
    await seedUsers();
    const count = await prisma.user.count({
      where: {
        email: { in: SEED_USERS.map((u) => u.email) },
      },
    });
    expect(count).toBe(6);

    // Verify passwords
    const jefe = await prisma.user.findUnique({
      where: { email: 'jefe@sgec.local' },
    });
    expect(jefe).toBeDefined();
    const valid = await verifyPassword('Cambiar123!', jefe!.passwordHash);
    expect(valid).toBe(true);
  });
});
