import type { RentalStatus } from './states/types.js';

export type EventPurpose = 'LUCRATIVE' | 'NON_LUCRATIVE';
export type RequestChannel = 'VERBAL' | 'WRITTEN' | 'EMAIL';
export type LegalDecision = 'APPROVED' | 'RETURNED';
export type DocumentKind = 'RESPONSE_LETTER' | 'PRIOR_STUDY' | 'CONTRACT';

export interface RentalRequest {
  id: string;
  status: RentalStatus;
  customerId: string;
  spaceId: string;
  eventName: string;
  eventDescription: string;
  purpose: EventPurpose;
  expectedAttendees: number;
  startsAt: Date;
  endsAt: Date;
  channel: RequestChannel;
  receivedAt: Date;
  requestRadicado: string | null;
  responseRadicado: string | null;
  quotedAmountPesos: number | null;
  quotedTariffId: string | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  updatedById: string | null;
}

export interface RequestDocument {
  id: string;
  rentalRequestId: string;
  requirementCode: string;
  receivedAt: Date | null;
  verifiedAt: Date | null;
  verifiedById: string | null;
  fileKey: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  updatedById: string | null;
}

export interface Contract {
  id: string;
  rentalRequestId: string;
  number: string | null;
  object: string;
  valuePesos: number;
  additionalClauses: string | null;
  signedAt: Date | null;
  signedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  updatedById: string | null;
}

export interface Payment {
  id: string;
  rentalRequestId: string;
  receiptNumber: string;
  bankName: string;
  voucherNumber: string;
  paidAt: Date;
  amountPesos: number;
  invoiceNumber: string;
  invoiceDate: Date;
  voucherFileKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  updatedById: string | null;
}

export interface LegalReview {
  id: string;
  rentalRequestId: string;
  round: number;
  reviewerId: string;
  documentsOk: boolean;
  customerDataOk: boolean;
  clausesOk: boolean;
  decision: LegalDecision;
  observations: string | null;
  reviewedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedDocument {
  id: string;
  rentalRequestId: string;
  kind: DocumentKind;
  version: number;
  html: string;
  generatedById: string;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RentalListFilters {
  status?: RentalStatus;
  search?: string;
  spaceId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
