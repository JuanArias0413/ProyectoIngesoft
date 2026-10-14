import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma, withAuditUpdate } from '../../../infra/prisma.js';
import type {
  IVenueRepository,
  ISpaceRepository,
  ITariffRepository,
  IDocumentRequirementRepository,
} from '../domain/repository.js';
import type {
  Venue,
  Space,
  Tariff,
  DocumentRequirement,
  CustomerType,
  EventPurpose,
} from '../domain/entities.js';

export class PrismaVenueRepository implements IVenueRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async findAll(): Promise<Venue[]> {
    const records = await this.prisma.venue.findMany({
      orderBy: { name: 'asc' },
    });
    return records.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async findById(id: string): Promise<Venue | null> {
    const r = await this.prisma.venue.findUnique({ where: { id } });
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      address: r.address,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}

export class PrismaSpaceRepository implements ISpaceRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async findAll(): Promise<Space[]> {
    const records = await this.prisma.space.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => ({
      id: r.id,
      venueId: r.venueId,
      name: r.name,
      capacity: r.capacity,
      pricingUnit: r.pricingUnit as Space['pricingUnit'],
      active: r.active,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async findByVenueId(venueId: string): Promise<Space[]> {
    const records = await this.prisma.space.findMany({
      where: { venueId, active: true },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => ({
      id: r.id,
      venueId: r.venueId,
      name: r.name,
      capacity: r.capacity,
      pricingUnit: r.pricingUnit as Space['pricingUnit'],
      active: r.active,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async findById(id: string): Promise<Space | null> {
    const r = await this.prisma.space.findUnique({ where: { id } });
    if (!r) return null;
    return {
      id: r.id,
      venueId: r.venueId,
      name: r.name,
      capacity: r.capacity,
      pricingUnit: r.pricingUnit as Space['pricingUnit'],
      active: r.active,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}

export class PrismaTariffRepository implements ITariffRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async findActiveTariff(
    spaceId: string,
    purpose: EventPurpose,
    date: Date = new Date(),
  ): Promise<Tariff | null> {
    const r = await this.prisma.tariff.findFirst({
      where: {
        spaceId,
        purpose,
        validFrom: { lte: date },
        OR: [{ validTo: null }, { validTo: { gt: date } }],
      },
      orderBy: { validFrom: 'desc' },
    });

    if (!r) return null;
    return {
      id: r.id,
      spaceId: r.spaceId,
      purpose: r.purpose as EventPurpose,
      unit: r.unit as Tariff['unit'],
      pricePesos: r.pricePesos,
      validFrom: r.validFrom,
      validTo: r.validTo,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async findBySpaceId(spaceId: string): Promise<Tariff[]> {
    const records = await this.prisma.tariff.findMany({
      where: { spaceId },
      orderBy: [{ purpose: 'asc' }, { validFrom: 'desc' }],
    });
    return records.map((r) => ({
      id: r.id,
      spaceId: r.spaceId,
      purpose: r.purpose as EventPurpose,
      unit: r.unit as Tariff['unit'],
      pricePesos: r.pricePesos,
      validFrom: r.validFrom,
      validTo: r.validTo,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async updatePrice(id: string, newPricePesos: number, updatedById?: string): Promise<Tariff> {
    const data = withAuditUpdate({ pricePesos: newPricePesos }, updatedById);
    const r = await this.prisma.tariff.update({
      where: { id },
      data,
    });
    return {
      id: r.id,
      spaceId: r.spaceId,
      purpose: r.purpose as EventPurpose,
      unit: r.unit as Tariff['unit'],
      pricePesos: r.pricePesos,
      validFrom: r.validFrom,
      validTo: r.validTo,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}

export class PrismaDocumentRequirementRepository implements IDocumentRequirementRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async findByCustomerType(customerType: CustomerType): Promise<DocumentRequirement[]> {
    const records = await this.prisma.documentRequirement.findMany({
      where: { customerType },
      orderBy: { code: 'asc' },
    });
    return records.map((r) => ({
      id: r.id,
      customerType: r.customerType as CustomerType,
      code: r.code,
      name: r.name,
      mandatory: r.mandatory,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async findAll(): Promise<DocumentRequirement[]> {
    const records = await this.prisma.documentRequirement.findMany({
      orderBy: [{ customerType: 'asc' }, { code: 'asc' }],
    });
    return records.map((r) => ({
      id: r.id,
      customerType: r.customerType as CustomerType,
      code: r.code,
      name: r.name,
      mandatory: r.mandatory,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }
}
