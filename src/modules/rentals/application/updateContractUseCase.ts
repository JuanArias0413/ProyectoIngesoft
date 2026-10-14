import type { PrismaClient, Contract } from '@prisma/client';
import { UserRole as PrismaUserRole, RentalStatus } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../../../shared/errors.js';
import type { IDocumentRenderer } from './documentRenderer.js';

export interface UpdateContractInput {
  rentalRequestId: string;
  object?: string;
  additionalClauses?: string;
  actorId: string;
  actorRole: PrismaUserRole;
}

export interface UpdateContractResult {
  contract: Contract;
  version: number;
}

const EDITABLE_STATUSES: RentalStatus[] = [
  'CONTRACT_DRAFTED',
  'PAID',
  'RETURNED_BY_LEGAL',
];

export class UpdateContractUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly documentRenderer: IDocumentRenderer,
  ) {}

  public async execute(input: UpdateContractInput): Promise<UpdateContractResult> {
    const { rentalRequestId, object, additionalClauses, actorId, actorRole } = input;

    // 1. RBAC: Solo Auxiliar Administrativo edita contratos (CAR-05, AC-05.2)
    if (actorRole !== 'ADMIN_ASSISTANT') {
      throw new ForbiddenError(
        `El rol '${actorRole}' no está autorizado para editar la minuta del contrato`,
      );
    }

    // 2. Obtener solicitud con su contrato
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
      throw new ValidationError(
        'La solicitud aún no tiene contrato elaborado. Debe ejecutar la elaboración inicial primero (AC-05.1)',
      );
    }

    // 3. Validar estado editable
    if (!EDITABLE_STATUSES.includes(rental.status)) {
      if (rental.status === 'LEGAL_REVIEW') {
        throw new ValidationError(
          'No se puede editar el contrato mientras se encuentra en revisión jurídica',
        );
      }
      throw new ValidationError(
        `No se puede editar el contrato en el estado actual '${rental.status}'`,
      );
    }

    // 4. Validar contenido
    if (object !== undefined && !object.trim()) {
      throw new ValidationError('El objeto contractual no puede estar vacío');
    }

    const updatedObject = object !== undefined ? object.trim() : rental.contract.object;
    const updatedClauses =
      additionalClauses !== undefined
        ? additionalClauses.trim() || null
        : rental.contract.additionalClauses;

    // 5. Actualizar el contrato
    const contract = await this.prisma.contract.update({
      where: { rentalRequestId: rental.id },
      data: {
        object: updatedObject,
        additionalClauses: updatedClauses,
        updatedById: actorId,
      },
    });

    // 6. Determinar nueva versión incremental (AC-05.2)
    const existingCount = await this.prisma.generatedDocument.count({
      where: {
        rentalRequestId: rental.id,
        kind: 'PRIOR_STUDY',
      },
    });
    const nextVersion = existingCount + 1;

    // 7. Regenerar estudio previo y contrato con la nueva versión
    try {
      await this.documentRenderer.generatePriorStudyAndContract(
        rental.id,
        nextVersion,
        actorId,
      );
    } catch {
      // No bloquea la actualización de datos si el renderizador falla
    }

    return {
      contract,
      version: nextVersion,
    };
  }
}
