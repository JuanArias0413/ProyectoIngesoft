import { Reservation, ReservationStatus } from './entities.js';

export interface CreateReservationInput {
  spaceId: string;
  rentalRequestId: string;
  startsAt: Date;
  endsAt: Date;
  status?: ReservationStatus;
  createdById?: string | null;
}

export interface IReservationRepository {
  create(data: CreateReservationInput): Promise<Reservation>;
  findById(id: string): Promise<Reservation | null>;
  findByRentalRequestId(rentalRequestId: string): Promise<Reservation[]>;
  findActiveOverlapping(
    spaceId: string,
    startsAt: Date,
    endsAt: Date,
    excludeReservationId?: string,
  ): Promise<Reservation[]>;
  findByVenueAndRange(
    venueId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<Reservation[]>;
  updateStatus(
    id: string,
    status: ReservationStatus,
    updatedById?: string | null,
  ): Promise<Reservation>;
}
