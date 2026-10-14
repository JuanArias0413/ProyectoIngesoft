import type {
  RentalRequest,
  RequestDocument,
  Contract,
  Payment,
  LegalReview,
  GeneratedDocument,
  RentalListFilters,
} from './entities.js';
import type { StateTransitionRecord } from './states/types.js';

export interface IRentalRequestRepository {
  create(data: Omit<RentalRequest, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<RentalRequest>;
  findById(id: string): Promise<RentalRequest | null>;
  update(id: string, data: Partial<RentalRequest>): Promise<RentalRequest>;
  findMany(filters: RentalListFilters): Promise<{ items: RentalRequest[]; total: number }>;
}

export interface IRequestDocumentRepository {
  createMany(docs: Array<Omit<RequestDocument, 'id' | 'createdAt' | 'updatedAt'>>): Promise<RequestDocument[]>;
  findByRentalRequestId(rentalRequestId: string): Promise<RequestDocument[]>;
  findByRentalAndCode(rentalRequestId: string, requirementCode: string): Promise<RequestDocument | null>;
  update(id: string, data: Partial<RequestDocument>): Promise<RequestDocument>;
}

export interface IContractRepository {
  create(data: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Contract>;
  findByRentalRequestId(rentalRequestId: string): Promise<Contract | null>;
  update(id: string, data: Partial<Contract>): Promise<Contract>;
}

export interface IPaymentRepository {
  create(data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Payment>;
  findByRentalRequestId(rentalRequestId: string): Promise<Payment | null>;
}

export interface ILegalReviewRepository {
  create(data: Omit<LegalReview, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<LegalReview>;
  findByRentalRequestId(rentalRequestId: string): Promise<LegalReview[]>;
  getLatestRound(rentalRequestId: string): Promise<number>;
}

export interface IStateTransitionRepository {
  create(data: StateTransitionRecord): Promise<StateTransitionRecord>;
  findByRentalRequestId(rentalRequestId: string): Promise<StateTransitionRecord[]>;
}

export interface IGeneratedDocumentRepository {
  create(data: Omit<GeneratedDocument, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<GeneratedDocument>;
  findByRentalRequestId(rentalRequestId: string): Promise<GeneratedDocument[]>;
  findLatestByKind(rentalRequestId: string, kind: GeneratedDocument['kind']): Promise<GeneratedDocument | null>;
}
