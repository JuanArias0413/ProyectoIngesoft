import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../infra/prisma.js';
import {
  ValidationError,
  ForbiddenError,
  ConflictError,
  NotFoundError,
} from '../../../shared/errors.js';
import { AvailabilityService } from '../../agenda/application/availabilityService.js';
import type { CustomerType } from '../../customers/domain/entities.js';
import type {
  EventPurpose,
  RequestChannel,
  RentalRequest,
} from '../domain/entities.js';
import type { UserRole } from '../domain/states/types.js';

const ONE_HOUR_MS = 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface RegisterRentalCustomerInput {
  type: CustomerType;
  documentType: string;
  documentNumber: string;
  name: string;
  legalRepresentative?: string | null;
  email: string;
  phone: string;
  address: string;
}

export interface RegisterRentalInput {
  customer: RegisterRentalCustomerInput;
  spaceId: string;
  eventName: string;
  eventDescription: string;
  purpose: EventPurpose;
  expectedAttendees: number;
  startsAt: Date;
  endsAt: Date;
  channel: RequestChannel;
  requestRadicado?: string | null;
  actorId: string;
  actorRole: UserRole;
}

export interface RegisterRentalResult {
  rentalRequest: RentalRequest;
  customerId: string;
  reservationId: string;
  documentCount: number;
}

export class RegisterRentalUseCase {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly prisma: PrismaClient = defaultPrisma,
  ) {}

  public async execute(input: RegisterRentalInput): Promise<RegisterRentalResult> {
    const {
      customer,
      spaceId,
      eventName,
      eventDescription,
      purpose,
      expectedAttendees,
      startsAt,
      endsAt,
      channel,
      requestRadicado,
      actorId,
      actorRole,
    } = input;

    // RBAC: Solo Auxiliar Administrativo registra (CAR-01, SPEC §8)
    if (actorRole !== 'ADMIN_ASSISTANT') {
      throw new ForbiddenError(
        `El rol '${actorRole}' no tiene permiso para registrar solicitudes de alquiler`,
      );
    }

    // Validación de fechas (A-05, A-06, AC-01.3)
    if (!(startsAt instanceof Date) || isNaN(startsAt.getTime())) {
      throw new ValidationError('La fecha de inicio es inválida');
    }
    if (!(endsAt instanceof Date) || isNaN(endsAt.getTime())) {
      throw new ValidationError('La fecha de fin es inválida');
    }

    const now = Date.now();
    if (startsAt.getTime() <= now) {
      throw new ValidationError(
        'La reserva debe empezar en el futuro al momento del registro (regla A-06)',
      );
    }

    const diffMs = endsAt.getTime() - startsAt.getTime();
    if (diffMs <= 0) {
      throw new ValidationError('La fecha de fin debe ser posterior a la fecha de inicio');
    }
    if (diffMs < ONE_HOUR_MS) {
      throw new ValidationError(
        'La duración mínima de una reserva es de 1 hora (regla A-06)',
      );
    }
    if (diffMs > SEVEN_DAYS_MS) {
      throw new ValidationError(
        'La duración máxima de una reserva es de 7 días (regla A-06)',
      );
    }

    // Validación de espacio existente y activo
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
    });
    if (!space || !space.active) {
      throw new NotFoundError('El espacio solicitado no existe o no se encuentra activo');
    }

    // Verificación de disponibilidad previa (AC-01.4)
    const availability = await this.availabilityService.checkAvailability({
      spaceId,
      startsAt,
      endsAt,
    });
    if (!availability.available) {
      throw new ConflictError(
        'El espacio no se encuentra disponible en la franja seleccionada debido a una reserva existente',
      );
    }

    // Validación de campos del cliente
    if (!customer.documentNumber || !customer.documentNumber.trim()) {
      throw new ValidationError('El número de documento del cliente es obligatorio');
    }
    if (!customer.name || !customer.name.trim()) {
      throw new ValidationError('El nombre del cliente es obligatorio');
    }
    if (!customer.email || !customer.email.trim()) {
      throw new ValidationError('El correo electrónico del cliente es obligatorio');
    }

    // Ejecución transaccional (AC-01.1, AC-01.2, AC-01.5)
    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Find or create / update Customer (AC-01.2)
        const savedCustomer = await tx.customer.upsert({
          where: {
            type_documentNumber: {
              type: customer.type,
              documentNumber: customer.documentNumber.trim(),
            },
          },
          update: {
            documentType: customer.documentType,
            name: customer.name.trim(),
            legalRepresentative: customer.legalRepresentative?.trim() || null,
            email: customer.email.trim().toLowerCase(),
            phone: customer.phone.trim(),
            address: customer.address.trim(),
            updatedById: actorId,
          },
          create: {
            type: customer.type,
            documentType: customer.documentType,
            documentNumber: customer.documentNumber.trim(),
            name: customer.name.trim(),
            legalRepresentative: customer.legalRepresentative?.trim() || null,
            email: customer.email.trim().toLowerCase(),
            phone: customer.phone.trim(),
            address: customer.address.trim(),
            createdById: actorId,
          },
        });

        // 2. Create RentalRequest in REGISTERED (AC-01.1, AC-01.5)
        const radicadoClean = requestRadicado?.trim() || null;
        const rentalRequest = await tx.rentalRequest.create({
          data: {
            status: 'REGISTERED',
            customerId: savedCustomer.id,
            spaceId,
            eventName: eventName.trim(),
            eventDescription: eventDescription.trim(),
            purpose,
            expectedAttendees,
            startsAt,
            endsAt,
            channel,
            requestRadicado: radicadoClean,
            createdById: actorId,
          },
        });

        // 3. Create Reservation in HELD (A-04, AC-01.1)
        const reservation = await tx.reservation.create({
          data: {
            spaceId,
            rentalRequestId: rentalRequest.id,
            startsAt,
            endsAt,
            status: 'HELD',
            createdById: actorId,
          },
        });

        // 4. Create RequestDocument rows according to customerType (A-09, AC-04.1)
        const requirements = await tx.documentRequirement.findMany({
          where: { customerType: customer.type },
        });

        if (requirements.length > 0) {
          await tx.requestDocument.createMany({
            data: requirements.map((req) => ({
              rentalRequestId: rentalRequest.id,
              requirementCode: req.code,
              createdById: actorId,
            })),
          });
        }

        // 5. Create StateTransition record
        await tx.stateTransition.create({
          data: {
            rentalRequestId: rentalRequest.id,
            fromStatus: null,
            toStatus: 'REGISTERED',
            transition: 'register',
            actorId,
            note: radicadoClean ? `Radicado de entrada: ${radicadoClean}` : null,
            occurredAt: new Date(),
          },
        });

        return {
          rentalRequest: rentalRequest as unknown as RentalRequest,
          customerId: savedCustomer.id,
          reservationId: reservation.id,
          documentCount: requirements.length,
        };
      });
    } catch (err: unknown) {
      // Traducir error de exclusión de base de datos Postgres (23P01) a ConflictError
      if (
        err &&
        typeof err === 'object' &&
        ('code' in err || 'message' in err)
      ) {
        const message = String((err as { message?: string }).message || '');
        const code = (err as { code?: string }).code;
        if (
          code === '23P01' ||
          message.includes('23P01') ||
          message.includes('reservation_no_overlap')
        ) {
          throw new ConflictError(
            'El espacio ya se encuentra reservado en el horario solicitado por otra solicitud concurrente',
          );
        }
      }
      throw err;
    }
  }
}
