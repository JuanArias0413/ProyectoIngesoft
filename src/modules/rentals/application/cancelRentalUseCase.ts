import { PrismaClient, RentalStatus, ReservationStatus, UserRole } from '@prisma/client';
import { prisma } from '../../../infra/prisma.js';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  InvalidTransitionError,
} from '../../../shared/errors.js';
import { RentalContext } from '../domain/states/rentalContext.js';
import {
  UserRole as DomainUserRole,
} from '../domain/states/types.js';

export interface CancelRentalInput {
  rentalRequestId: string;
  reason: string;
  actorId: string;
  actorRole: UserRole;
}

export interface CancelRentalResult {
  rentalRequest: {
    id: string;
    status: RentalStatus;
    cancelReason: string | null;
  };
  previousStatus: RentalStatus;
}

export class CancelRentalUseCase {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  public async execute(input: CancelRentalInput): Promise<CancelRentalResult> {
    const { rentalRequestId, reason, actorId, actorRole } = input;

    if (!rentalRequestId) {
      throw new ValidationError('El ID de la solicitud es obligatorio');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      throw new ValidationError(
        'El motivo de cancelación debe tener al menos 10 caracteres',
      );
    }
    if (!actorId) {
      throw new ValidationError('El actorId es obligatorio');
    }

    if (
      actorRole !== UserRole.ADMIN_ASSISTANT &&
      actorRole !== UserRole.OFFICE_HEAD
    ) {
      throw new ForbiddenError(
        `El rol '${actorRole}' no está autorizado para cancelar solicitudes`,
      );
    }

    const rental = await this.prismaClient.rentalRequest.findUnique({
      where: { id: rentalRequestId },
      include: {
        payment: true,
        reservations: true,
      },
    });

    if (!rental) {
      throw new NotFoundError(`Solicitud con ID ${rentalRequestId} no encontrada`);
    }

    // Validación del estado de dominio
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

    const check = context.can('cancel', actorRole as DomainUserRole);
    if (!check.allowed) {
      throw new InvalidTransitionError(rental.status, 'cancel', check.reason);
    }

    const trimmedReason = reason.trim();
    context.transition('cancel', actorRole as DomainUserRole, { reason: trimmedReason });

    // A-11: Detectar si hubo pago previo y anotar necesidad de trámite de devolución
    const paidStatuses: RentalStatus[] = [
      RentalStatus.PAID,
      RentalStatus.LEGAL_REVIEW,
      RentalStatus.RETURNED_BY_LEGAL,
      RentalStatus.PENDING_SIGNATURE,
    ];
    const hadPayment = rental.payment !== null || paidStatuses.includes(rental.status);

    const transitionNote = hadPayment
      ? `${trimmedReason} [A-11: Se detectó pago registrado; requiere gestión administrativa de devolución]`
      : trimmedReason;

    const now = new Date();

    const result = await this.prismaClient.$transaction(async (tx) => {
      // 1. Liberar reservas asociadas (ReservationStatus.RELEASED)
      await tx.reservation.updateMany({
        where: { rentalRequestId: rental.id },
        data: {
          status: ReservationStatus.RELEASED,
          updatedById: actorId,
        },
      });

      // 2. Actualizar solicitud a CANCELLED con cancelReason
      const updatedRental = await tx.rentalRequest.update({
        where: { id: rental.id },
        data: {
          status: RentalStatus.CANCELLED,
          cancelReason: trimmedReason,
          updatedById: actorId,
        },
      });

      // 3. Registrar transición de estado
      await tx.stateTransition.create({
        data: {
          rentalRequestId: rental.id,
          fromStatus: rental.status,
          toStatus: RentalStatus.CANCELLED,
          transition: 'cancel',
          actorId,
          note: transitionNote,
          occurredAt: now,
        },
      });

      return {
        rentalRequest: {
          id: updatedRental.id,
          status: updatedRental.status,
          cancelReason: updatedRental.cancelReason,
        },
        previousStatus: rental.status,
      };
    });

    return result;
  }
}
