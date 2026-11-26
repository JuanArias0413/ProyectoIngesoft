export type CustomerType = 'NATURAL' | 'LEGAL';

export interface Customer {
  id: string;
  type: CustomerType;
  documentType: string;
  documentNumber: string;
  name: string;
  legalRepresentative: string | null;
  email: string;
  phone: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  updatedById: string | null;
}

export interface UpsertCustomerInput {
  type: CustomerType;
  documentType: string;
  documentNumber: string;
  name: string;
  legalRepresentative?: string | null;
  email: string;
  phone: string;
  address: string;
  actorId?: string | null;
}
