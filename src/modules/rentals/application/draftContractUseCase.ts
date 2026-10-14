import type { PrismaClient, RentalRequest, Contract } from '@prisma/client';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { NotFoundError } from '../../../shared/errors.js';
import { RentalContext } from '../domain/states/rentalContext.js';
import type { UserRole as DomainUserRole } from '../domain/states/types.js';
import type { IDocumentRenderer } from './documentRenderer.js';

export interface DraftContractInput {
  rentalRequestId: string;
  object?: string;
  additionalClauses?: string;
  actorId: string;
  actorRole: PrismaUserRole;
}

export interface DraftContractResult {
  rentalRequest: RentalRequest;
  contract: Contract;
}

export class DraftContractUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly documentRenderer: IDocumentRenderer,
  ) {}

  public async execute(input: DraftContractInput): Promise<DraftContractResult> {
    const { rentalRequestId, object, additionalClauses, actorId, actorRole } = input;

    // 1. Obtener la solicitud con espacio y escenario
    const rental = await this.prisma.rentalRequest.findUnique({
      where: { id: rentalRequestId },
      include: {
        space: {
          include: {
            venue: true,
          },
        },
        contract: true,
      },
    });

    if (!rental) {
      throw new NotFoundError(`Solicitud con ID ${rentalRequestId} no encontrada`);
    }

    // 2. Validar transición mediante máquina de estados del dominio
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
      'draftContract',
      actorRole as unknown as DomainUserRole,
      undefined,
      actorId,
    );

    // 3. Determinar objeto del contrato y cláusulas
    const defaultObject = `Arrendamiento temporal del espacio ${rental.space.name} ubicado en ${rental.space.venue.name} para la realización del evento «${rental.eventName}».`;
    const contractObject = object?.trim() ? object.trim() : defaultObject;
    const cleanedClauses = additionalClauses?.trim() ? additionalClauses.trim() : null;
    const valuePesos = rental.quotedAmountPesos ?? 0;

    // 4. Persistir atómicamente el contrato, la actualización de estado y la transición
    const { updatedRental, contract } = await this.prisma.$transaction(async (tx) => {
      const savedContract = await tx.contract.upsert({
        where: { rentalRequestId: rental.id },
        create: {
          rentalRequestId: rental.id,
          object: contractObject,
          valuePesos,
          additionalClauses: cleanedClauses,
          createdById: actorId,
          updatedById: actorId,
        },
        update: {
          object: contractObject,
          valuePesos,
          additionalClauses: cleanedClauses,
          updatedById: actorId,
        },
      });

      const updated = await tx.rentalRequest.update({
        where: { id: rental.id },
        data: {
          status: 'CONTRACT_DRAFTED',
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
          note: transitionRecord.note ?? 'Estudio previo y minuta de contrato elaborados (v1)',
          occurredAt: transitionRecord.occurredAt,
        },
      });

      return { updatedRental: updated, contract: savedContract };
    });

    // 5. Generar snapshots imprimibles A4 de estudio previo y contrato (versión 1)
    try {
      await this.documentRenderer.generatePriorStudyAndContract(rental.id, 1, actorId);
    } catch {
      // Si la generación de documentos falla o está en modo de prueba liviano, no bloquea la persistencia
    }

    return {
      rentalRequest: updatedRental,
      contract,
    };
  }
}
