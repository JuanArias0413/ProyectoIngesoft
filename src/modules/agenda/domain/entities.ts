export type ReservationStatus = 'HELD' | 'CONFIRMED' | 'RELEASED';

export interface Reservation {
  id: string;
  spaceId: string;
  rentalRequestId: string;
  startsAt: Date;
  endsAt: Date;
  status: ReservationStatus;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  updatedById: string | null;
}

export interface ConflictingReservationSummary {
  id: string;
  rentalRequestId: string;
  startsAt: Date;
  endsAt: Date;
  status: ReservationStatus;
}

export interface AvailabilityCheckResult {
  available: boolean;
  spaceId: string;
  startsAt: Date;
  endsAt: Date;
  conflictingReservation?: ConflictingReservationSummary;
}
