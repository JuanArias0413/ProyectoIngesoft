import type { PrismaClient, RentalRequest } from '@prisma/client';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { NotFoundError } from '../../../shared/errors.js';
import { RentalContext } from '../domain/states/rentalContext.js';
import type { UserRole as DomainUserRole } from '../domain/states/types.js';

export interface SubmitToLegalInput {
  rentalRequestId: string;
  actorId: string;
  actorRole: PrismaUserRole;
  note?: string;
}

export interface SubmitToLegalResult {
  rentalRequest: RentalRequest;
}

export class SubmitToLegalUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  public async execute(input: SubmitToLegalInput): Promise<SubmitToLegalResult> {
    const { rentalRequestId, actorId, actorRole, note } = input;

    // 1. Obtener la solicitud
    const rental = await this.prisma.rentalRequest.findUnique({
      where: { id: rentalRequestId },
      include: {
        payment: true,
        contract: true,
      },
    });

    if (!rental) {
      throw new NotFoundError(`Solicitud con ID ${rentalRequestId} no encontrada`);
    }

    // 2. Transición mediante máquina de estados del dominio (PAID -> LEGAL_REVIEW)
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
      'submitToLegal',
      actorRole as unknown as DomainUserRole,
      undefined,
      actorId,
    );

    // 3. Persistir atómicamente el estado LEGAL_REVIEW y la transición
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedReq = await tx.rentalRequest.update({
        where: { id: rental.id },
        data: {
          status: 'LEGAL_REVIEW',
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
            note?.trim() ||
            transitionRecord.note ||
            'Expediente y minuta de contrato enviados a la Oficina Jurídica para revisión formal',
          occurredAt: transitionRecord.occurredAt,
        },
      });

      return updatedReq;
    });

    return {
      rentalRequest: updated,
    };
  }
}
