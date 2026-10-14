import type { PrismaClient, RentalRequest, LegalReview } from '@prisma/client';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { NotFoundError } from '../../../shared/errors.js';
import { RentalContext } from '../domain/states/rentalContext.js';
import type { UserRole as DomainUserRole } from '../domain/states/types.js';

export interface ApproveLegalInput {
  rentalRequestId: string;
  documentsOk: boolean;
  customerDataOk: boolean;
  clausesOk: boolean;
  observations?: string;
  actorId: string;
  actorRole: PrismaUserRole;
}

export interface ApproveLegalResult {
  rentalRequest: RentalRequest;
  legalReview: LegalReview;
}

export class ApproveLegalUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  public async execute(input: ApproveLegalInput): Promise<ApproveLegalResult> {
    const {
      rentalRequestId,
      documentsOk,
      customerDataOk,
      clausesOk,
      observations,
      actorId,
      actorRole,
    } = input;

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
      'approveLegal',
      actorRole as unknown as DomainUserRole,
      {
        documentsOk,
        customerDataOk,
        clausesOk,
        observations,
      },
      actorId,
    );

    // 3. Persistir atómicamente la revisión jurídica APPROVED, el cambio a PENDING_SIGNATURE y la transición
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
          documentsOk,
          customerDataOk,
          clausesOk,
          decision: 'APPROVED',
          observations: observations?.trim() || null,
        },
      });

      const updated = await tx.rentalRequest.update({
        where: { id: rental.id },
        data: {
          status: 'PENDING_SIGNATURE',
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
            observations?.trim() ||
            transitionRecord.note ||
            `Revisión jurídica aprobada con las 3 verificaciones completas (Ronda ${round})`,
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
