import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../infra/prisma.js';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/errors.js';
import { ITariffRepository } from '../../catalog/domain/repository.js';
import { calculateRentalPrice } from '../domain/pricing/pricingCalculator.js';
import { RentalContext } from '../domain/states/rentalContext.js';
import type { UserRole } from '../domain/states/types.js';
import type { IDocumentRenderer } from './documentRenderer.js';
import type { RentalRequest } from '../domain/entities.js';

export interface RespondRentalInput {
  rentalRequestId: string;
  responseRadicado: string;
  actorId: string;
  actorRole: UserRole;
}

export interface RespondRentalResult {
  rentalRequest: RentalRequest;
  quotedAmountPesos: number;
  responseRadicado: string;
  quotedTariffId: string;
}

export class RespondRentalUseCase {
  constructor(
    private readonly tariffRepo: ITariffRepository,
    private readonly documentRenderer: IDocumentRenderer,
    private readonly prisma: PrismaClient = defaultPrisma,
  ) {}

  public async execute(input: RespondRentalInput): Promise<RespondRentalResult> {
    const { rentalRequestId, responseRadicado, actorId, actorRole } = input;

    // RBAC: Solo Auxiliar Administrativo responde solicitudes (SPEC §8, CAR-03)
    if (actorRole !== 'ADMIN_ASSISTANT') {
      throw new ForbiddenError(
        `El rol '${actorRole}' no tiene permiso para responder solicitudes de alquiler`,
      );
    }

    // Validación de radicado de respuesta obligatorio (A-02, AC-03.3)
    if (!responseRadicado || !responseRadicado.trim()) {
      throw new ValidationError(
        'El número de radicado del oficio de respuesta es obligatorio (regla A-02)',
      );
    }

    // Cargar solicitud
    const current = await this.prisma.rentalRequest.findUnique({
      where: { id: rentalRequestId },
    });
    if (!current) {
      throw new NotFoundError('La solicitud de alquiler no fue encontrada');
    }

    // Instanciar máquina de estados mediante RentalContext
    const context = new RentalContext({
      id: current.id,
      status: current.status as RentalContext['status'],
      customerId: current.customerId,
      spaceId: current.spaceId,
      eventName: current.eventName,
      eventDescription: current.eventDescription,
      purpose: current.purpose,
      expectedAttendees: current.expectedAttendees,
      startsAt: current.startsAt,
      endsAt: current.endsAt,
      channel: current.channel,
      requestRadicado: current.requestRadicado,
      responseRadicado: current.responseRadicado,
      quotedAmountPesos: current.quotedAmountPesos,
      quotedTariffId: current.quotedTariffId,
      cancelReason: current.cancelReason,
    });

    // Buscar tarifa vigente para el espacio y propósito solicitados (A-07, AC-03.3)
    const activeTariff = await this.tariffRepo.findActiveTariff(
      current.spaceId,
      current.purpose,
      current.startsAt,
    );

    if (!activeTariff) {
      throw new ValidationError(
        'No existe una tarifa vigente para el espacio y propósito solicitados (regla A-07)',
      );
    }

    // Calcular valor según estrategia de precios correspondiente (Hourly o Daily)
    const calculation = calculateRentalPrice({
      startsAt: current.startsAt,
      endsAt: current.endsAt,
      tariff: activeTariff,
    });

    const quotedAmountPesos = calculation.amountPesos;

    // Ejecutar transición mediante State Pattern
    const transitionRecord = context.transition(
      'respond',
      actorRole,
      {
        responseRadicado: responseRadicado.trim(),
        quotedAmountPesos,
        quotedTariffId: activeTariff.id,
      },
      actorId,
    );

    // Persistir cambios transaccionalmente en la base de datos
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.rentalRequest.update({
        where: { id: rentalRequestId },
        data: {
          status: 'RESPONDED',
          responseRadicado: responseRadicado.trim(),
          quotedAmountPesos,
          quotedTariffId: activeTariff.id,
          updatedById: actorId,
        },
      });

      await tx.stateTransition.create({
        data: {
          rentalRequestId: transitionRecord.rentalRequestId,
          fromStatus: transitionRecord.fromStatus,
          toStatus: transitionRecord.toStatus,
          transition: transitionRecord.transition,
          actorId: transitionRecord.actorId,
          note: transitionRecord.note,
          occurredAt: transitionRecord.occurredAt,
        },
      });

      return saved;
    });

    // Generar snapshot del oficio de respuesta (CAR-03, AC-03.1, AC-03.2)
    try {
      await this.documentRenderer.generateResponseLetter(rentalRequestId);
    } catch {
      // Si el renderizador de documentos no está disponible o falla, no bloquea el estado
    }

    return {
      rentalRequest: updated as unknown as RentalRequest,
      quotedAmountPesos,
      responseRadicado: responseRadicado.trim(),
      quotedTariffId: activeTariff.id,
    };
  }
}
