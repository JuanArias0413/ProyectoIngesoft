import type { Customer, CustomerType, UpsertCustomerInput } from './entities.js';

export interface ICustomerRepository {
  findById(id: string): Promise<Customer | null>;
  findByTypeAndNumber(type: CustomerType, documentNumber: string): Promise<Customer | null>;
  upsert(input: UpsertCustomerInput): Promise<Customer>;
}
