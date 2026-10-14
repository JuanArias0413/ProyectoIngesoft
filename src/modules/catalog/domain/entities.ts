export type PricingUnit = 'HOUR' | 'DAY';
export type EventPurpose = 'LUCRATIVE' | 'NON_LUCRATIVE';
export type CustomerType = 'NATURAL' | 'LEGAL';

export interface Venue {
  id: string;
  name: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Space {
  id: string;
  venueId: string;
  name: string;
  capacity: number;
  pricingUnit: PricingUnit;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tariff {
  id: string;
  spaceId: string;
  purpose: EventPurpose;
  unit: PricingUnit;
  pricePesos: number;
  validFrom: Date;
  validTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentRequirement {
  id: string;
  customerType: CustomerType;
  code: string;
  name: string;
  mandatory: boolean;
  createdAt: Date;
  updatedAt: Date;
}
