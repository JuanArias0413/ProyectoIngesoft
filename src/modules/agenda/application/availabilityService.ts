import { ValidationError } from '../../../shared/errors.js';
import {
  AvailabilityCheckResult,
  Reservation,
} from '../domain/entities.js';
import { IReservationRepository } from '../domain/repository.js';

const ONE_HOUR_MS = 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface CheckAvailabilityParams {
  spaceId: string;
  startsAt: Date;
  endsAt: Date;
  excludeReservationId?: string;
  enforceDurationLimits?: boolean;
}

export class AvailabilityService {
  constructor(private readonly reservationRepo: IReservationRepository) {}

  public async checkAvailability(
    params: CheckAvailabilityParams,
  ): Promise<AvailabilityCheckResult> {
    const {
      spaceId,
      startsAt,
      endsAt,
      excludeReservationId,
      enforceDurationLimits = true,
    } = params;

    if (!(startsAt instanceof Date) || isNaN(startsAt.getTime())) {
      throw new ValidationError('La fecha de inicio es inválida');
    }
    if (!(endsAt instanceof Date) || isNaN(endsAt.getTime())) {
      throw new ValidationError('La fecha de fin es inválida');
    }

    const diffMs = endsAt.getTime() - startsAt.getTime();
    if (diffMs <= 0) {
      throw new ValidationError('La fecha de fin debe ser posterior a la fecha de inicio');
    }

    if (enforceDurationLimits) {
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
    }

    const overlapping = await this.reservationRepo.findActiveOverlapping(
      spaceId,
      startsAt,
      endsAt,
      excludeReservationId,
    );

    if (overlapping.length > 0) {
      const firstConflict = overlapping[0];
      return {
        available: false,
        spaceId,
        startsAt,
        endsAt,
        conflictingReservation: {
          id: firstConflict.id,
          rentalRequestId: firstConflict.rentalRequestId,
          startsAt: firstConflict.startsAt,
          endsAt: firstConflict.endsAt,
          status: firstConflict.status,
        },
      };
    }

    return {
      available: true,
      spaceId,
      startsAt,
      endsAt,
    };
  }

  public async getVenueAgenda(
    venueId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<Reservation[]> {
    if (toDate.getTime() <= fromDate.getTime()) {
      throw new ValidationError(
        'El rango de consulta es inválido: la fecha final debe ser posterior a la inicial',
      );
    }
    return this.reservationRepo.findByVenueAndRange(venueId, fromDate, toDate);
  }
}
