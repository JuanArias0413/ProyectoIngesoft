import type { PrismaClient, RentalRequest, LegalReview } from '@prisma/client';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { NotFoundError } from '../../../shared/errors.js';
import { RentalContext } from '../domain/states/rentalContext.js';
import type { UserRole as DomainUserRole } from '../domain/states/types.js';

export interface ReturnLegalInput {
  rentalRequestId: string;
  observations: string;
  actorId: string;
  actorRole: PrismaUserRole;
}

export interface ReturnLegalResult {
  rentalRequest: RentalRequest;
  legalReview: LegalReview;
}

export class ReturnLegalUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  public async execute(input: ReturnLegalInput): Promise<ReturnLegalResult> {
    const { rentalRequestId, observations, actorId, actorRole } = input;

    // 1. Obtener la solicitud
    const rental = await this.prisma.rentalRequest.findUnique({
      where: { id: rentalRequestId },
      include: {
        contract: true,
        legalReviews: true,
      },
    });

    if (!rental) {
      throw new NotFoundError(`Solicitud con ID ${rentalRequestId} no encontrada`);
    }

    // 2. Transición y validaciones de negocio en máquina de estados
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
      'returnLegal',
      actorRole as unknown as DomainUserRole,
      { observations: observations.trim() },
      actorId,
    );

    // 3. Persistir atómicamente la revisión jurídica RETURNED, el cambio a RETURNED_BY_LEGAL y la transición
    const { updatedRental, savedReview } = await this.prisma.$transaction(async (tx) => {
      const roundCount = await tx.legalReview.count({
        where: { rentalRequestId: rental.id },
      });
      const round = roundCount + 1;

      const review = await tx.legalReview.create({
        data: {
          rentalRequestId: rental.id,
          round,
          reviewerId: actorId,
          documentsOk: false,
          customerDataOk: false,
          clausesOk: false,
          decision: 'RETURNED',
          observations: observations.trim(),
        },
      });

      const updated = await tx.rentalRequest.update({
        where: { id: rental.id },
        data: {
          status: 'RETURNED_BY_LEGAL',
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
            `Devuelto por Jurídica (Ronda ${round}): ${observations.trim()}`,
          occurredAt: transitionRecord.occurredAt,
        },
      });

      return { updatedRental: updated, savedReview: review };
    });

    return {
      rentalRequest: updatedRental,
      legalReview: savedReview,
    };
  }
}
