import type { PrismaClient, RentalRequest } from '@prisma/client';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors.js';
import { RentalContext } from '../domain/states/rentalContext.js';
import type { UserRole as DomainUserRole } from '../domain/states/types.js';

export interface VerifyDocumentsInput {
  rentalRequestId: string;
  actorId: string;
  actorRole: PrismaUserRole;
}

export interface VerifyDocumentsResult {
  rentalRequest: RentalRequest;
  verifiedCount: number;
  mandatoryCount: number;
}

export class VerifyDocumentsUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  public async execute(input: VerifyDocumentsInput): Promise<VerifyDocumentsResult> {
    const { rentalRequestId, actorId, actorRole } = input;

    const rental = await this.prisma.rentalRequest.findUnique({
      where: { id: rentalRequestId },
      include: {
        customer: true,
        requestDocuments: true,
      },
    });

    if (!rental) {
      throw new NotFoundError(`Solicitud con ID ${rentalRequestId} no encontrada`);
    }

    // 1. Obtener requisitos obligatorios para el tipo de cliente
    const mandatoryRequirements = await this.prisma.documentRequirement.findMany({
      where: {
        customerType: rental.customer.type,
        mandatory: true,
      },
    });

    // 2. Comprobar que cada requisito obligatorio esté verificado (AC-04.4)
    const verifiedCodes = new Set(
      rental.requestDocuments
        .filter((d) => d.verifiedAt !== null)
        .map((d) => d.requirementCode),
    );

    const unverifiedMandatory = mandatoryRequirements.filter(
      (req) => !verifiedCodes.has(req.code),
    );

    if (unverifiedMandatory.length > 0) {
      const missingNames = unverifiedMandatory.map((r) => r.name).join(', ');
      throw new ValidationError(
        `Todos los documentos obligatorios exigidos al cliente deben estar verificados (AC-04.4). Pendientes: ${missingNames}`,
      );
    }

    // 3. Ejecutar transición mediante la máquina de estados del dominio
    const context = new RentalContext({
      id: rental.id,
      status: rental.status,
      customerId: rental.customerId,
      spaceId: rental.spaceId,
      eventName: rental.eventName,
      eventDescription: rental.eventDescription,
      purpose: rental.purpose,
      expectedAttendees: rental.expectedAttendees,
      startsAt: rental.startsAt,
      endsAt: rental.endsAt,
      channel: rental.channel,
      requestRadicado: rental.requestRadicado,
      responseRadicado: rental.responseRadicado,
      quotedAmountPesos: rental.quotedAmountPesos,
      quotedTariffId: rental.quotedTariffId,
      cancelReason: rental.cancelReason,
    });

    const transitionRecord = context.transition(
      'verifyDocuments',
      actorRole as unknown as DomainUserRole,
      { allMandatoryVerified: true },
      actorId,
    );

    // 4. Persistir atómicamente el nuevo estado y la transición
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedReq = await tx.rentalRequest.update({
        where: { id: rental.id },
        data: {
          status: 'DOCUMENTS_VERIFIED',
          updatedById: actorId,
        },
      });

      await tx.stateTransition.create({
        data: {
          rentalRequestId: rental.id,
          fromStatus: transitionRecord.fromStatus,
          toStatus: transitionRecord.toStatus,
          transition: transitionRecord.transition,
          actorId,
          note:
            transitionRecord.note ??
            `Checklist documental verificado (${mandatoryRequirements.length} obligatorios conformes)`,
          occurredAt: transitionRecord.occurredAt,
        },
      });

      return updatedReq;
    });

    return {
      rentalRequest: updated,
      verifiedCount: verifiedCodes.size,
      mandatoryCount: mandatoryRequirements.length,
    };
  }
}
