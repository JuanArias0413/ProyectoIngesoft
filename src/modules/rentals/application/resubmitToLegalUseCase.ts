import type { PrismaClient, RentalRequest, Contract } from '@prisma/client';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors.js';
import { RentalContext } from '../domain/states/rentalContext.js';
import type { UserRole as DomainUserRole } from '../domain/states/types.js';
import type { IDocumentRenderer } from './documentRenderer.js';

export interface ResubmitToLegalInput {
  rentalRequestId: string;
  object?: string;
  additionalClauses?: string;
  note?: string;
  actorId: string;
  actorRole: PrismaUserRole;
}

export interface ResubmitToLegalResult {
  rentalRequest: RentalRequest;
  contract?: Contract | null;
  version?: number;
}

export class ResubmitToLegalUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly documentRenderer: IDocumentRenderer,
  ) {}

  public async execute(input: ResubmitToLegalInput): Promise<ResubmitToLegalResult> {
    const { rentalRequestId, object, additionalClauses, note, actorId, actorRole } = input;

    // 1. Obtener la solicitud con su contrato
    const rental = await this.prisma.rentalRequest.findUnique({
      where: { id: rentalRequestId },
      include: {
        contract: true,
      },
    });

    if (!rental) {
      throw new NotFoundError(`Solicitud con ID ${rentalRequestId} no encontrada`);
    }

    if (!rental.contract) {
      throw new ValidationError('La solicitud no tiene un contrato elaborado');
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
      'resubmitToLegal',
      actorRole as unknown as DomainUserRole,
      undefined,
      actorId,
    );

    // 3. Manejo de correcciones de contrato y versionamiento si aplica
    let updatedContract = rental.contract;
    let nextVersion: number | undefined;

    const hasObjectChange = object !== undefined && object.trim() !== '' && object.trim() !== rental.contract.object;
    const hasClausesChange =
      additionalClauses !== undefined &&
      (additionalClauses.trim() || null) !== rental.contract.additionalClauses;

    if (hasObjectChange || hasClausesChange) {
      const existingCount = await this.prisma.generatedDocument.count({
        where: {
          rentalRequestId: rental.id,
          kind: 'PRIOR_STUDY',
        },
      });
      nextVersion = existingCount + 1;

      updatedContract = await this.prisma.contract.update({
        where: { rentalRequestId: rental.id },
        data: {
          object: hasObjectChange ? object!.trim() : rental.contract.object,
          additionalClauses: hasClausesChange ? additionalClauses!.trim() || null : rental.contract.additionalClauses,
          updatedById: actorId,
        },
      });

      try {
        await this.documentRenderer.generatePriorStudyAndContract(
          rental.id,
          nextVersion,
          actorId,
        );
      } catch {
        // Tolerancia a fallos de render si no bloquea el flujo
      }
    }

    // 4. Persistir atómicamente el estado LEGAL_REVIEW y la transición
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
            'Minuta subsanada y reenviada a la Oficina Jurídica para nueva ronda de revisión',
          occurredAt: transitionRecord.occurredAt,
        },
      });

      return updatedReq;
    });

    return {
      rentalRequest: updated,
      contract: updatedContract,
      version: nextVersion,
    };
  }
}
