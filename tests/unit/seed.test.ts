import { describe, it, expect } from 'vitest';
import { RentalStatus } from '@prisma/client';
import { prisma } from '../../src/infra/prisma.js';
import {
  seedUsers,
  seedCatalog,
  seedDocumentRequirements,
  seedDemoRentals,
  SEED_USERS,
  DEMO_RENTAL_IDS,
} from '../../prisma/seed.js';
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

  it('seeds catalog and document requirements without errors', async () => {
    await seedCatalog();
    await seedDocumentRequirements();
    const spaces = await prisma.space.count();
    const reqs = await prisma.documentRequirement.count();
    expect(spaces).toBeGreaterThanOrEqual(3);
    expect(reqs).toBe(7);
  });

  it('seeds demo rentals in all 10 states and is strictly idempotent', async () => {
    await seedUsers();
    await seedCatalog();
    await seedDocumentRequirements();

    // Primera ejecución
    await seedDemoRentals();

    const countFirst = await prisma.rentalRequest.count({
      where: { id: { in: DEMO_RENTAL_IDS } },
    });
    expect(countFirst).toBe(10);

    const statuses = await prisma.rentalRequest.findMany({
      where: { id: { in: DEMO_RENTAL_IDS } },
      select: { status: true },
    });
    const uniqueStatuses = new Set(statuses.map((s) => s.status));
    expect(uniqueStatuses.size).toBe(10);
    for (const status of Object.values(RentalStatus)) {
      expect(uniqueStatuses.has(status)).toBe(true);
    }

    // Segunda ejecución para verificar idempotencia
    await seedDemoRentals();
    const countSecond = await prisma.rentalRequest.count({
      where: { id: { in: DEMO_RENTAL_IDS } },
    });
    expect(countSecond).toBe(10);

    const legalizedRental = await prisma.rentalRequest.findUnique({
      where: { id: 'rental-demo-09-legalized' },
      include: {
        contract: true,
        generatedDocuments: true,
        reservations: true,
      },
    });
    expect(legalizedRental).toBeDefined();
    expect(legalizedRental!.contract?.number).toBe('ARR-2026-0001');
    expect(legalizedRental!.reservations[0].status).toBe('CONFIRMED');
    expect(legalizedRental!.generatedDocuments.length).toBeGreaterThanOrEqual(3);
  });
});

