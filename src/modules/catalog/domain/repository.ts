import type { Venue, Space, Tariff, DocumentRequirement, CustomerType, EventPurpose } from './entities.js';

export interface IVenueRepository {
  findAll(): Promise<Venue[]>;
  findById(id: string): Promise<Venue | null>;
}

export interface ISpaceRepository {
  findAll(): Promise<Space[]>;
  findByVenueId(venueId: string): Promise<Space[]>;
  findById(id: string): Promise<Space | null>;
}

export interface ITariffRepository {
  findActiveTariff(spaceId: string, purpose: EventPurpose, date?: Date): Promise<Tariff | null>;
  findBySpaceId(spaceId: string): Promise<Tariff[]>;
  updatePrice(id: string, newPricePesos: number, updatedById?: string): Promise<Tariff>;
}

export interface IDocumentRequirementRepository {
  findByCustomerType(customerType: CustomerType): Promise<DocumentRequirement[]>;
  findAll(): Promise<DocumentRequirement[]>;
}
