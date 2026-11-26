import { describe, it, expect, beforeAll } from 'vitest';
import {
  PrismaVenueRepository,
  PrismaSpaceRepository,
  PrismaTariffRepository,
  PrismaDocumentRequirementRepository,
} from '../../src/modules/catalog/infra/prismaCatalogRepositories.js';
import { seedCatalog, seedDocumentRequirements } from '../../prisma/seed.js';

describe('Catalog Module & Repositories', () => {
  const venueRepo = new PrismaVenueRepository();
  const spaceRepo = new PrismaSpaceRepository();
  const tariffRepo = new PrismaTariffRepository();
  const reqRepo = new PrismaDocumentRequirementRepository();

  beforeAll(async () => {
    await seedCatalog();
    await seedDocumentRequirements();
  });

  it('lists all venues and finds venue by id', async () => {
    const venues = await venueRepo.findAll();
    expect(venues.length).toBeGreaterThanOrEqual(2);

    const lucy = await venueRepo.findById('venue-lucy-tejada');
    expect(lucy).toBeDefined();
    expect(lucy!.name).toBe('Centro Cultural Lucy Tejada');
  });

  it('lists spaces by venue id', async () => {
    const lucySpaces = await spaceRepo.findByVenueId('venue-lucy-tejada');
    expect(lucySpaces.length).toBe(2);
    expect(lucySpaces.map((s) => s.name)).toContain('Auditorio Principal');
    expect(lucySpaces.map((s) => s.name)).toContain('Sala Múltiple');

    const teatroSpaces = await spaceRepo.findByVenueId('venue-santiago-londono');
    expect(teatroSpaces.length).toBe(1);
    expect(teatroSpaces[0].pricingUnit).toBe('DAY');
  });

  it('finds active tariff by purpose and space', async () => {
    const lucrative = await tariffRepo.findActiveTariff(
      'space-auditorio-principal',
      'LUCRATIVE',
      new Date('2026-06-01T12:00:00Z'),
    );
    expect(lucrative).toBeDefined();
    expect(lucrative!.pricePesos).toBe(450000);
    expect(lucrative!.unit).toBe('HOUR');

    const nonLucrative = await tariffRepo.findActiveTariff(
      'space-auditorio-principal',
      'NON_LUCRATIVE',
    );
    expect(nonLucrative).toBeDefined();
    expect(nonLucrative!.pricePesos).toBe(250000);
  });

  it('updates tariff price with audit tracking', async () => {
    const updated = await tariffRepo.updatePrice('tariff-mult-non-luc', 130000, 'admin-user-id');
    expect(updated.pricePesos).toBe(130000);

    // Verify it reflects in findActiveTariff
    const active = await tariffRepo.findActiveTariff('space-sala-multiple', 'NON_LUCRATIVE');
    expect(active!.pricePesos).toBe(130000);

    // Restore original price
    await tariffRepo.updatePrice('tariff-mult-non-luc', 120000);
  });

  it('retrieves document requirements according to customer type (A-09)', async () => {
    const naturalReqs = await reqRepo.findByCustomerType('NATURAL');
    expect(naturalReqs.length).toBe(3);
    const naturalCodes = naturalReqs.map((r) => r.code);
    expect(naturalCodes).toContain('CC');
    expect(naturalCodes).toContain('RUT');
    expect(naturalCodes).toContain('EVENT_DESC');

    const legalReqs = await reqRepo.findByCustomerType('LEGAL');
    expect(legalReqs.length).toBe(4);
    const legalCodes = legalReqs.map((r) => r.code);
    expect(legalCodes).toContain('CERT_EXISTENCE');
    expect(legalCodes).toContain('RUT');
    expect(legalCodes).toContain('REP_DOC');
    expect(legalCodes).toContain('EVENT_DESC');
  });
});
