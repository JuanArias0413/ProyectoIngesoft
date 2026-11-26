import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../infra/prisma.js';
import type { Customer, CustomerType, UpsertCustomerInput } from '../domain/entities.js';
import type { ICustomerRepository } from '../domain/repository.js';

export class PrismaCustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  public async findById(id: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({
      where: { id },
    });
  }

  public async findByTypeAndNumber(
    type: CustomerType,
    documentNumber: string,
  ): Promise<Customer | null> {
    return this.prisma.customer.findUnique({
      where: {
        type_documentNumber: {
          type,
          documentNumber,
        },
      },
    });
  }

  public async upsert(input: UpsertCustomerInput): Promise<Customer> {
    return this.prisma.customer.upsert({
      where: {
        type_documentNumber: {
          type: input.type,
          documentNumber: input.documentNumber,
        },
      },
      update: {
        documentType: input.documentType,
        name: input.name,
        legalRepresentative: input.legalRepresentative ?? null,
        email: input.email,
        phone: input.phone,
        address: input.address,
        updatedById: input.actorId ?? null,
      },
      create: {
        type: input.type,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        name: input.name,
        legalRepresentative: input.legalRepresentative ?? null,
        email: input.email,
        phone: input.phone,
        address: input.address,
        createdById: input.actorId ?? null,
      },
    });
  }
}
