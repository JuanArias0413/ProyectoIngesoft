import { PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../../shared/errors.js';
import {
  Reservation,
  ReservationStatus,
} from '../domain/entities.js';
import {
  CreateReservationInput,
  IReservationRepository,
} from '../domain/repository.js';

function isExclusionViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string; meta?: Record<string, unknown> };
  if (err.code === '23P01') return true;
  if (err.code === 'P2002') return true;
  const msg = typeof err.message === 'string' ? err.message : '';
  return (
    msg.includes('23P01') ||
    msg.includes('reservation_no_overlap') ||
    msg.includes('exclusion constraint') ||
    msg.includes('conflicting key value violates exclusion constraint')
  );
}

export class PrismaReservationRepository implements IReservationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: CreateReservationInput): Promise<Reservation> {
    try {
      const created = await this.prisma.reservation.create({
        data: {
          spaceId: data.spaceId,
          rentalRequestId: data.rentalRequestId,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          status: data.status ?? 'HELD',
          createdById: data.createdById ?? null,
        },
      });

      return {
        id: created.id,
        spaceId: created.spaceId,
        rentalRequestId: created.rentalRequestId,
        startsAt: created.startsAt,
        endsAt: created.endsAt,
        status: created.status as ReservationStatus,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        createdById: created.createdById,
        updatedById: created.updatedById,
      };
    } catch (error: unknown) {
      if (isExclusionViolation(error)) {
        throw new ConflictError(
          'El espacio ya cuenta con una reserva activa en la franja horaria seleccionada',
        );
      }
      throw error;
    }
  }

  public async findById(id: string): Promise<Reservation | null> {
    const record = await this.prisma.reservation.findUnique({
      where: { id },
    });
    if (!record) return null;

    return {
      id: record.id,
      spaceId: record.spaceId,
      rentalRequestId: record.rentalRequestId,
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      status: record.status as ReservationStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdById: record.createdById,
      updatedById: record.updatedById,
    };
  }

  public async findByRentalRequestId(rentalRequestId: string): Promise<Reservation[]> {
    const records = await this.prisma.reservation.findMany({
      where: { rentalRequestId },
      orderBy: { startsAt: 'asc' },
    });

    return records.map((record) => ({
      id: record.id,
      spaceId: record.spaceId,
      rentalRequestId: record.rentalRequestId,
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      status: record.status as ReservationStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdById: record.createdById,
      updatedById: record.updatedById,
    }));
  }

  public async findActiveOverlapping(
    spaceId: string,
    startsAt: Date,
    endsAt: Date,
    excludeReservationId?: string,
  ): Promise<Reservation[]> {
    // Rango semiabierto [startsAt, endsAt)
    // Se solapa si startsAt < existing.endsAt Y endsAt > existing.startsAt
    // Reservas activas son HELD o CONFIRMED (A-05, RELEASED se ignora)
    const records = await this.prisma.reservation.findMany({
      where: {
        spaceId,
        status: { in: ['HELD', 'CONFIRMED'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
      orderBy: { startsAt: 'asc' },
    });

    return records.map((record) => ({
      id: record.id,
      spaceId: record.spaceId,
      rentalRequestId: record.rentalRequestId,
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      status: record.status as ReservationStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdById: record.createdById,
      updatedById: record.updatedById,
    }));
  }

  public async findByVenueAndRange(
    venueId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<Reservation[]> {
    const records = await this.prisma.reservation.findMany({
      where: {
        space: { venueId },
        status: { in: ['HELD', 'CONFIRMED'] },
        startsAt: { lt: toDate },
        endsAt: { gt: fromDate },
      },
      orderBy: { startsAt: 'asc' },
    });

    return records.map((record) => ({
      id: record.id,
      spaceId: record.spaceId,
      rentalRequestId: record.rentalRequestId,
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      status: record.status as ReservationStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdById: record.createdById,
      updatedById: record.updatedById,
    }));
  }

  public async updateStatus(
    id: string,
    status: ReservationStatus,
    updatedById?: string | null,
  ): Promise<Reservation> {
    try {
      const updated = await this.prisma.reservation.update({
        where: { id },
        data: {
          status,
          updatedById: updatedById ?? null,
        },
      });

      return {
        id: updated.id,
        spaceId: updated.spaceId,
        rentalRequestId: updated.rentalRequestId,
        startsAt: updated.startsAt,
        endsAt: updated.endsAt,
        status: updated.status as ReservationStatus,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        createdById: updated.createdById,
        updatedById: updated.updatedById,
      };
    } catch (error: unknown) {
      if (isExclusionViolation(error)) {
        throw new ConflictError(
          'El espacio ya cuenta con una reserva activa en la franja horaria seleccionada',
        );
      }
      const err = error as { code?: string };
      if (err.code === 'P2025') {
        throw new NotFoundError(`Reserva con id ${id} no encontrada`);
      }
      throw error;
    }
  }
}
