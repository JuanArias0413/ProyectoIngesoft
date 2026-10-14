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
import type { IDocumentRenderer } from './IDocumentRenderer.js';

export interface SignAndNumberInput {
  rentalRequestId: string;
  actorId: string;
  actorRole: UserRole;
  notes?: string;
}

export interface SignAndNumberResult {
  rentalRequest: {
    id: string;
    status: RentalStatus;
  };
  contract: {
    id: string;
    number: string | null;
    signedAt: Date | null;
    signedById: string | null;
  };
  contractNumber: string;
}

export class SignAndNumberUseCase {
  constructor(
    private readonly prismaClient: PrismaClient = prisma,
    private readonly documentRenderer?: IDocumentRenderer,
  ) {}

  public async execute(input: SignAndNumberInput): Promise<SignAndNumberResult> {
    const { rentalRequestId, actorId, actorRole, notes } = input;

    if (!rentalRequestId) {
      throw new ValidationError('El ID de la solicitud es obligatorio');
    }
    if (!actorId) {
      throw new ValidationError('El actorId es obligatorio');
    }

    if (actorRole !== UserRole.SECRETARY) {
      throw new ForbiddenError(
        `El rol '${actorRole}' no está autorizado para firmar y numerar contratos (solo el Secretario de Cultura)`,
      );
    }

    const rental = await this.prismaClient.rentalRequest.findUnique({
      where: { id: rentalRequestId },
      include: {
        contract: true,
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

    const check = context.can('signAndNumber', actorRole as DomainUserRole);
    if (!check.allowed) {
      throw new InvalidTransitionError(rental.status, 'signAndNumber', check.reason);
    }

    if (!rental.contract) {
      throw new ValidationError('No existe un borrador de contrato elaborado para esta solicitud');
    }

    context.transition('signAndNumber', actorRole as DomainUserRole);

    const now = new Date();
    const currentYear = now.getFullYear();

    // Asignación atómica de número y actualización de estado en transacción
    const result = await this.prismaClient.$transaction(async (tx) => {
      // Incremento atómico en ContractSequence (A-03, AC-08.1, AC-08.3)
      const seqResult = await tx.$queryRaw<{ lastValue: number }[]>`
        INSERT INTO "ContractSequence" ("year", "lastValue")
        VALUES (${currentYear}, 1)
        ON CONFLICT ("year")
        DO UPDATE SET "lastValue" = "ContractSequence"."lastValue" + 1
        RETURNING "lastValue";
      `;

      const lastVal = Number(seqResult[0]?.lastValue ?? 1);
      const contractNumber = `ARR-${currentYear}-${String(lastVal).padStart(4, '0')}`;

      // 1. Actualizar contrato con número oficial y firma
      const updatedContract = await tx.contract.update({
        where: { rentalRequestId: rental.id },
        data: {
          number: contractNumber,
          signedAt: now,
          signedById: actorId,
          updatedById: actorId,
        },
      });

      // 2. Confirmar reserva provisional (HELD -> CONFIRMED, AC-08.2)
      await tx.reservation.updateMany({
        where: { rentalRequestId: rental.id },
        data: {
          status: ReservationStatus.CONFIRMED,
          updatedById: actorId,
        },
      });

      // 3. Actualizar estado de solicitud -> LEGALIZED
      const updatedRental = await tx.rentalRequest.update({
        where: { id: rental.id },
        data: {
          status: RentalStatus.LEGALIZED,
          updatedById: actorId,
        },
      });

      // 4. Registrar transición de estado
      const transitionNote = notes
        ? `Firma y numeración oficial ${contractNumber}: ${notes}`
        : `Firma y numeración oficial ${contractNumber}`;

      await tx.stateTransition.create({
        data: {
          rentalRequestId: rental.id,
          fromStatus: rental.status,
          toStatus: RentalStatus.LEGALIZED,
          transition: 'signAndNumber',
          actorId,
          note: transitionNote,
          occurredAt: now,
        },
      });

      return {
        rentalRequest: {
          id: updatedRental.id,
          status: updatedRental.status,
        },
        contract: {
          id: updatedContract.id,
          number: updatedContract.number,
          signedAt: updatedContract.signedAt,
          signedById: updatedContract.signedById,
        },
        contractNumber,
      };
    });

    // 5. Generar snapshot final inmutable del contrato con el número oficial
    if (this.documentRenderer) {
      try {
        await this.documentRenderer.generateFinalContract(rental.id, actorId);
      } catch {
        // No revertir la firma ya consumada si falla la generación visual secundaria
      }
    }

    return result;
  }
}
