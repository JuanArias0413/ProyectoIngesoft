import { prisma } from '../../src/infra/prisma.js';
import { seedCatalog, seedDocumentRequirements, seedUsers } from '../../prisma/seed.js';

export async function cleanDatabase(): Promise<void> {
  // Truncate transactional tables with foreign key cascades
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "StateTransition",
      "GeneratedDocument",
      "LegalReview",
      "Payment",
      "Contract",
      "RequestDocument",
      "Reservation",
      "RentalRequest",
      "Customer"
    CASCADE;
  `);

  // Remove any dynamic spaces/venues/tariffs created by factories
  await prisma.$executeRawUnsafe(`DELETE FROM "Tariff" WHERE "spaceId" NOT LIKE 'space-%';`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Space" WHERE "id" NOT LIKE 'space-%';`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Venue" WHERE "id" NOT LIKE 'venue-%';`);

  // Ensure catalog, users, and document requirements are always intact
  await seedUsers();
  await seedCatalog();
  await seedDocumentRequirements();
}

export async function disconnectDatabase(): Promise<void> {
  // No-op during test suite execution to prevent prematurely closing shared pool
}
