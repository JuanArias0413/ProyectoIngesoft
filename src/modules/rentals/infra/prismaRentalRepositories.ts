import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../infra/prisma.js';
import type {
  RentalRequest,
  RequestDocument,
  Contract,
  Payment,
  LegalReview,
  GeneratedDocument,
  RentalListFilters,
} from '../domain/entities.js';
import type {
  IRentalRequestRepository,
  IRequestDocumentRepository,
  IContractRepository,
  IPaymentRepository,
  ILegalReviewRepository,
  IStateTransitionRepository,
  IGeneratedDocumentRepository,
} from '../domain/repository.js';
import type { StateTransitionRecord } from '../domain/states/types.js';

export class PrismaRentalRequestRepository implements IRentalRequestRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  public async create(
    data: Omit<RentalRequest, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ): Promise<RentalRequest> {
    const created = await this.prisma.rentalRequest.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        status: data.status,
        customerId: data.customerId,
        spaceId: data.spaceId,
        eventName: data.eventName,
        eventDescription: data.eventDescription,
        purpose: data.purpose,
        expectedAttendees: data.expectedAttendees,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        channel: data.channel,
        receivedAt: data.receivedAt,
        requestRadicado: data.requestRadicado,
        responseRadicado: data.responseRadicado,
        quotedAmountPesos: data.quotedAmountPesos,
        quotedTariffId: data.quotedTariffId,
        cancelReason: data.cancelReason,
        createdById: data.createdById,
        updatedById: data.updatedById,
      },
    });
    return created as unknown as RentalRequest;
  }

  public async findById(id: string): Promise<RentalRequest | null> {
    const item = await this.prisma.rentalRequest.findUnique({
      where: { id },
    });
    return item ? (item as unknown as RentalRequest) : null;
  }

  public async update(id: string, data: Partial<RentalRequest>): Promise<RentalRequest> {
    const updated = await this.prisma.rentalRequest.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.eventName !== undefined && { eventName: data.eventName }),
        ...(data.eventDescription !== undefined && { eventDescription: data.eventDescription }),
        ...(data.expectedAttendees !== undefined && { expectedAttendees: data.expectedAttendees }),
        ...(data.purpose !== undefined && { purpose: data.purpose }),
        ...(data.channel !== undefined && { channel: data.channel }),
        ...(data.startsAt !== undefined && { startsAt: data.startsAt }),
        ...(data.endsAt !== undefined && { endsAt: data.endsAt }),
        ...(data.requestRadicado !== undefined && { requestRadicado: data.requestRadicado }),
        ...(data.responseRadicado !== undefined && { responseRadicado: data.responseRadicado }),
        ...(data.quotedAmountPesos !== undefined && { quotedAmountPesos: data.quotedAmountPesos }),
        ...(data.quotedTariffId !== undefined && { quotedTariffId: data.quotedTariffId }),
        ...(data.cancelReason !== undefined && { cancelReason: data.cancelReason }),
        ...(data.updatedById !== undefined && { updatedById: data.updatedById }),
      },
    });
    return updated as unknown as RentalRequest;
  }

  public async findMany(filters: RentalListFilters): Promise<{ items: RentalRequest[]; total: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, filters.pageSize ?? 20);
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.spaceId) {
      where.spaceId = filters.spaceId;
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { eventName: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { documentNumber: { contains: q, mode: 'insensitive' } } },
        { contract: { number: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.rentalRequest.count({ where }),
      this.prisma.rentalRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items: items as unknown as RentalRequest[],
      total,
    };
  }
}

export class PrismaRequestDocumentRepository implements IRequestDocumentRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  public async createMany(
    docs: Array<Omit<RequestDocument, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<RequestDocument[]> {
    const created: RequestDocument[] = [];
    for (const doc of docs) {
      const item = await this.prisma.requestDocument.create({
        data: {
          rentalRequestId: doc.rentalRequestId,
          requirementCode: doc.requirementCode,
          receivedAt: doc.receivedAt,
          verifiedAt: doc.verifiedAt,
          verifiedById: doc.verifiedById,
          fileKey: doc.fileKey,
          notes: doc.notes,
          createdById: doc.createdById,
          updatedById: doc.updatedById,
        },
      });
      created.push(item as unknown as RequestDocument);
    }
    return created;
  }

  public async findByRentalRequestId(rentalRequestId: string): Promise<RequestDocument[]> {
    const docs = await this.prisma.requestDocument.findMany({
      where: { rentalRequestId },
      orderBy: { createdAt: 'asc' },
    });
    return docs as unknown as RequestDocument[];
  }

  public async findByRentalAndCode(
    rentalRequestId: string,
    requirementCode: string,
  ): Promise<RequestDocument | null> {
    const doc = await this.prisma.requestDocument.findFirst({
      where: { rentalRequestId, requirementCode },
    });
    return doc ? (doc as unknown as RequestDocument) : null;
  }

  public async update(id: string, data: Partial<RequestDocument>): Promise<RequestDocument> {
    const updated = await this.prisma.requestDocument.update({
      where: { id },
      data: {
        ...(data.receivedAt !== undefined && { receivedAt: data.receivedAt }),
        ...(data.verifiedAt !== undefined && { verifiedAt: data.verifiedAt }),
        ...(data.verifiedById !== undefined && { verifiedById: data.verifiedById }),
        ...(data.fileKey !== undefined && { fileKey: data.fileKey }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.updatedById !== undefined && { updatedById: data.updatedById }),
      },
    });
    return updated as unknown as RequestDocument;
  }
}

export class PrismaContractRepository implements IContractRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  public async create(
    data: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ): Promise<Contract> {
    const item = await this.prisma.contract.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        rentalRequestId: data.rentalRequestId,
        number: data.number,
        object: data.object,
        valuePesos: data.valuePesos,
        additionalClauses: data.additionalClauses,
        signedAt: data.signedAt,
        signedById: data.signedById,
        createdById: data.createdById,
        updatedById: data.updatedById,
      },
    });
    return item as unknown as Contract;
  }

  public async findByRentalRequestId(rentalRequestId: string): Promise<Contract | null> {
    const item = await this.prisma.contract.findUnique({
      where: { rentalRequestId },
    });
    return item ? (item as unknown as Contract) : null;
  }

  public async update(id: string, data: Partial<Contract>): Promise<Contract> {
    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        ...(data.number !== undefined && { number: data.number }),
        ...(data.object !== undefined && { object: data.object }),
        ...(data.valuePesos !== undefined && { valuePesos: data.valuePesos }),
        ...(data.additionalClauses !== undefined && { additionalClauses: data.additionalClauses }),
        ...(data.signedAt !== undefined && { signedAt: data.signedAt }),
        ...(data.signedById !== undefined && { signedById: data.signedById }),
        ...(data.updatedById !== undefined && { updatedById: data.updatedById }),
      },
    });
    return updated as unknown as Contract;
  }
}

export class PrismaPaymentRepository implements IPaymentRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  public async create(
    data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ): Promise<Payment> {
    const item = await this.prisma.payment.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        rentalRequestId: data.rentalRequestId,
        receiptNumber: data.receiptNumber,
        bankName: data.bankName,
        voucherNumber: data.voucherNumber,
        paidAt: data.paidAt,
        amountPesos: data.amountPesos,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        voucherFileKey: data.voucherFileKey,
        createdById: data.createdById,
        updatedById: data.updatedById,
      },
    });
    return item as unknown as Payment;
  }

  public async findByRentalRequestId(rentalRequestId: string): Promise<Payment | null> {
    const item = await this.prisma.payment.findUnique({
      where: { rentalRequestId },
    });
    return item ? (item as unknown as Payment) : null;
  }
}

export class PrismaLegalReviewRepository implements ILegalReviewRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  public async create(
    data: Omit<LegalReview, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ): Promise<LegalReview> {
    const item = await this.prisma.legalReview.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        rentalRequestId: data.rentalRequestId,
        round: data.round,
        reviewerId: data.reviewerId,
        documentsOk: data.documentsOk,
        customerDataOk: data.customerDataOk,
        clausesOk: data.clausesOk,
        decision: data.decision,
        observations: data.observations,
        reviewedAt: data.reviewedAt,
      },
    });
    return item as unknown as LegalReview;
  }

  public async findByRentalRequestId(rentalRequestId: string): Promise<LegalReview[]> {
    const reviews = await this.prisma.legalReview.findMany({
      where: { rentalRequestId },
      orderBy: { round: 'asc' },
    });
    return reviews as unknown as LegalReview[];
  }

  public async getLatestRound(rentalRequestId: string): Promise<number> {
    const latest = await this.prisma.legalReview.findFirst({
      where: { rentalRequestId },
      orderBy: { round: 'desc' },
      select: { round: true },
    });
    return latest?.round ?? 0;
  }
}

export class PrismaStateTransitionRepository implements IStateTransitionRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  public async create(data: StateTransitionRecord): Promise<StateTransitionRecord> {
    const created = await this.prisma.stateTransition.create({
      data: {
        rentalRequestId: data.rentalRequestId,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        transition: data.transition,
        actorId: data.actorId,
        note: data.note,
        occurredAt: data.occurredAt,
      },
    });
    return {
      id: created.id,
      rentalRequestId: created.rentalRequestId,
      fromStatus: created.fromStatus as StateTransitionRecord['fromStatus'],
      toStatus: created.toStatus as StateTransitionRecord['toStatus'],
      transition: created.transition as StateTransitionRecord['transition'],
      actorId: created.actorId,
      note: created.note,
      occurredAt: created.occurredAt,
    };
  }

  public async findByRentalRequestId(rentalRequestId: string): Promise<StateTransitionRecord[]> {
    const transitions = await this.prisma.stateTransition.findMany({
      where: { rentalRequestId },
      orderBy: { occurredAt: 'asc' },
    });
    return transitions.map((t) => ({
      id: t.id,
      rentalRequestId: t.rentalRequestId,
      fromStatus: t.fromStatus as StateTransitionRecord['fromStatus'],
      toStatus: t.toStatus as StateTransitionRecord['toStatus'],
      transition: t.transition as StateTransitionRecord['transition'],
      actorId: t.actorId,
      note: t.note,
      occurredAt: t.occurredAt,
    }));
  }
}

export class PrismaGeneratedDocumentRepository implements IGeneratedDocumentRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  public async create(
    data: Omit<GeneratedDocument, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ): Promise<GeneratedDocument> {
    const item = await this.prisma.generatedDocument.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        rentalRequestId: data.rentalRequestId,
        kind: data.kind,
        version: data.version,
        html: data.html,
        generatedById: data.generatedById,
        generatedAt: data.generatedAt,
      },
    });
    return item as unknown as GeneratedDocument;
  }

  public async findByRentalRequestId(rentalRequestId: string): Promise<GeneratedDocument[]> {
    const docs = await this.prisma.generatedDocument.findMany({
      where: { rentalRequestId },
      orderBy: { version: 'desc' },
    });
    return docs as unknown as GeneratedDocument[];
  }

  public async findLatestByKind(
    rentalRequestId: string,
    kind: GeneratedDocument['kind'],
  ): Promise<GeneratedDocument | null> {
    const doc = await this.prisma.generatedDocument.findFirst({
      where: { rentalRequestId, kind },
      orderBy: { version: 'desc' },
    });
    return doc ? (doc as unknown as GeneratedDocument) : null;
  }
}
