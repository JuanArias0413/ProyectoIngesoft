import type { PrismaClient, RequestDocument } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors.js';

export interface MarkReceivedInput {
  rentalRequestId: string;
  requirementCode: string;
  actorId: string;
  notes?: string;
}

export interface AttachFileInput {
  rentalRequestId: string;
  requirementCode: string;
  fileKey: string;
  actorId: string;
}

export interface VerifyDocumentInput {
  rentalRequestId: string;
  requirementCode: string;
  actorId: string;
}

export class ManageDocumentsUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  public async markReceived(input: MarkReceivedInput): Promise<RequestDocument> {
    const { rentalRequestId, requirementCode, actorId, notes } = input;

    const rental = await this.prisma.rentalRequest.findUnique({
      where: { id: rentalRequestId },
    });
    if (!rental) {
      throw new NotFoundError(`Solicitud con ID ${rentalRequestId} no encontrada`);
    }

    if (rental.status !== 'REGISTERED' && rental.status !== 'RESPONDED') {
      throw new ValidationError(
        `No se pueden modificar documentos en el estado actual '${rental.status}'`,
      );
    }

    const doc = await this.prisma.requestDocument.findFirst({
      where: {
        rentalRequestId,
        requirementCode,
      },
    });

    if (!doc) {
      throw new NotFoundError(
        `Documento con código '${requirementCode}' no pertenece a la solicitud`,
      );
    }

    return this.prisma.requestDocument.update({
      where: { id: doc.id },
      data: {
        receivedAt: new Date(),
        notes: notes !== undefined ? notes : doc.notes,
        updatedById: actorId,
      },
    });
  }

  public async attachFile(input: AttachFileInput): Promise<RequestDocument> {
    const { rentalRequestId, requirementCode, fileKey, actorId } = input;

    const rental = await this.prisma.rentalRequest.findUnique({
      where: { id: rentalRequestId },
    });
    if (!rental) {
      throw new NotFoundError(`Solicitud con ID ${rentalRequestId} no encontrada`);
    }

    if (rental.status !== 'REGISTERED' && rental.status !== 'RESPONDED') {
      throw new ValidationError(
        `No se pueden adjuntar documentos en el estado actual '${rental.status}'`,
      );
    }

    const doc = await this.prisma.requestDocument.findFirst({
      where: {
        rentalRequestId,
        requirementCode,
      },
    });

    if (!doc) {
      throw new NotFoundError(
        `Documento con código '${requirementCode}' no pertenece a la solicitud`,
      );
    }

    return this.prisma.requestDocument.update({
      where: { id: doc.id },
      data: {
        fileKey,
        receivedAt: doc.receivedAt ?? new Date(),
        updatedById: actorId,
      },
    });
  }

  public async verifyDocument(input: VerifyDocumentInput): Promise<RequestDocument> {
    const { rentalRequestId, requirementCode, actorId } = input;

    const rental = await this.prisma.rentalRequest.findUnique({
      where: { id: rentalRequestId },
    });
    if (!rental) {
      throw new NotFoundError(`Solicitud con ID ${rentalRequestId} no encontrada`);
    }

    if (rental.status !== 'REGISTERED' && rental.status !== 'RESPONDED') {
      throw new ValidationError(
        `No se pueden verificar documentos en el estado actual '${rental.status}'`,
      );
    }

    const doc = await this.prisma.requestDocument.findFirst({
      where: {
        rentalRequestId,
        requirementCode,
      },
    });

    if (!doc) {
      throw new NotFoundError(
        `Documento con código '${requirementCode}' no pertenece a la solicitud`,
      );
    }

    return this.prisma.requestDocument.update({
      where: { id: doc.id },
      data: {
        verifiedAt: new Date(),
        verifiedById: actorId,
        receivedAt: doc.receivedAt ?? new Date(),
        updatedById: actorId,
      },
    });
  }
}
