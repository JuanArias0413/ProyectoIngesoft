import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/infra/prisma.js';
import { cleanDatabase, disconnectDatabase } from '../helpers/db.js';
import {
  createVenue,
  createSpace,
  createCustomer,
  createRentalRequest,
} from '../helpers/factories.js';
import {
  PrismaReservationRepository,
  AvailabilityService,
} from '../../src/modules/agenda/index.js';
import { ConflictError, ValidationError } from '../../src/shared/errors.js';

describe('Agenda & Availability Service (Integration)', () => {
  let reservationRepo: PrismaReservationRepository;
  let availabilityService: AvailabilityService;
  let venueId: string;
  let spaceId: string;
  let customerId: string;
  let rentalRequestId1: string;
  let rentalRequestId2: string;

  beforeEach(async () => {
    await cleanDatabase();

    reservationRepo = new PrismaReservationRepository(prisma);
    availabilityService = new AvailabilityService(reservationRepo);

    const venue = await createVenue();
    venueId = venue.id;

    const space = await createSpace(venueId);
    spaceId = space.id;

    const customer = await createCustomer();
    customerId = customer.id;

    const req1 = await createRentalRequest(customerId, spaceId);
    rentalRequestId1 = req1.id;

    const req2 = await createRentalRequest(customerId, spaceId);
    rentalRequestId2 = req2.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('1. Libre: indica disponible cuando no hay reservas previas en la franja', async () => {
    const startsAt = new Date('2026-11-15T08:00:00.000Z');
    const endsAt = new Date('2026-11-15T12:00:00.000Z');

    const result = await availabilityService.checkAvailability({
      spaceId,
      startsAt,
      endsAt,
    });

    expect(result.available).toBe(true);
    expect(result.spaceId).toBe(spaceId);
    expect(result.conflictingReservation).toBeUndefined();
  });

  it('2. Solapado: detecta conflicto cuando existe una reserva activa en la franja', async () => {
    const existingStart = new Date('2026-11-15T10:00:00.000Z');
    const existingEnd = new Date('2026-11-15T14:00:00.000Z');

    const created = await reservationRepo.create({
      spaceId,
      rentalRequestId: rentalRequestId1,
      startsAt: existingStart,
      endsAt: existingEnd,
      status: 'HELD',
    });

    // Caso solapado por la derecha (12:00 a 16:00)
    const queryStart = new Date('2026-11-15T12:00:00.000Z');
    const queryEnd = new Date('2026-11-15T16:00:00.000Z');

    const result = await availabilityService.checkAvailability({
      spaceId,
      startsAt: queryStart,
      endsAt: queryEnd,
    });

    expect(result.available).toBe(false);
    expect(result.conflictingReservation).toBeDefined();
    expect(result.conflictingReservation?.id).toBe(created.id);
    expect(result.conflictingReservation?.rentalRequestId).toBe(rentalRequestId1);
    expect(result.conflictingReservation?.status).toBe('HELD');
  });

  it('3. Contiguo: reservas contiguas [10:00, 14:00) y [14:00, 18:00) no entran en conflicto (A-05)', async () => {
    const res1Start = new Date('2026-11-15T10:00:00.000Z');
    const res1End = new Date('2026-11-15T14:00:00.000Z');

    await reservationRepo.create({
      spaceId,
      rentalRequestId: rentalRequestId1,
      startsAt: res1Start,
      endsAt: res1End,
      status: 'HELD',
    });

    // Reserva inmediatamente contigua que inicia exactamente cuando termina la anterior
    const res2Start = new Date('2026-11-15T14:00:00.000Z');
    const res2End = new Date('2026-11-15T18:00:00.000Z');

    const check = await availabilityService.checkAvailability({
      spaceId,
      startsAt: res2Start,
      endsAt: res2End,
    });

    expect(check.available).toBe(true);

    // Debe insertarse con éxito tanto en la BD como en la restricción EXCLUDE
    const createdRes2 = await reservationRepo.create({
      spaceId,
      rentalRequestId: rentalRequestId2,
      startsAt: res2Start,
      endsAt: res2End,
      status: 'CONFIRMED',
    });

    expect(createdRes2.id).toBeDefined();
    expect(createdRes2.status).toBe('CONFIRMED');
  });

  it('4. Liberado: reservas con estado RELEASED no bloquean la franja horaria (A-04, AC-02.3)', async () => {
    const slotStart = new Date('2026-11-15T08:00:00.000Z');
    const slotEnd = new Date('2026-11-15T12:00:00.000Z');

    const released = await reservationRepo.create({
      spaceId,
      rentalRequestId: rentalRequestId1,
      startsAt: slotStart,
      endsAt: slotEnd,
      status: 'RELEASED',
    });
    expect(released.status).toBe('RELEASED');

    // La consulta de disponibilidad debe mostrar el espacio como libre
    const check = await availabilityService.checkAvailability({
      spaceId,
      startsAt: slotStart,
      endsAt: slotEnd,
    });
    expect(check.available).toBe(true);

    // Y permite crear una nueva reserva HELD en exactamente las mismas horas
    const newReservation = await reservationRepo.create({
      spaceId,
      rentalRequestId: rentalRequestId2,
      startsAt: slotStart,
      endsAt: slotEnd,
      status: 'HELD',
    });

    expect(newReservation.id).toBeDefined();
    expect(newReservation.status).toBe('HELD');
  });

  it('5. Carrera concurrente: dos inserciones simultáneas en franja solapada → una triunfa y otra lanza ConflictError (23P01)', async () => {
    const startsAt = new Date('2026-11-20T10:00:00.000Z');
    const endsAt = new Date('2026-11-20T14:00:00.000Z');

    // Lanzamos ambas operaciones concurrentemente contra la base de datos
    const results = await Promise.allSettled([
      reservationRepo.create({
        spaceId,
        rentalRequestId: rentalRequestId1,
        startsAt,
        endsAt,
        status: 'HELD',
      }),
      reservationRepo.create({
        spaceId,
        rentalRequestId: rentalRequestId2,
        startsAt,
        endsAt,
        status: 'HELD',
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactamente una debe haber triunfado y la otra debe haber sido rechazada
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // La fallida debe ser específicamente un ConflictError tipado (código 23P01 traducido)
    const failureReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(failureReason).toBeInstanceOf(ConflictError);
    expect(failureReason.statusCode).toBe(409);
    expect(failureReason.message).toContain('reserva activa');
  });

  it('6. Regla A-06: valida duración mínima de 1 hora y máxima de 7 días', async () => {
    const now = new Date('2026-11-15T10:00:00.000Z');
    const tooShort = new Date('2026-11-15T10:30:00.000Z'); // 30 mins
    const tooLong = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000); // 8 días

    await expect(
      availabilityService.checkAvailability({
        spaceId,
        startsAt: now,
        endsAt: tooShort,
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      availabilityService.checkAvailability({
        spaceId,
        startsAt: now,
        endsAt: tooLong,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('7. Agenda de escenario: lista reservas en la ventana consultada', async () => {
    const start1 = new Date('2026-11-15T08:00:00.000Z');
    const end1 = new Date('2026-11-15T12:00:00.000Z');
    const start2 = new Date('2026-11-16T14:00:00.000Z');
    const end2 = new Date('2026-11-16T18:00:00.000Z');

    await reservationRepo.create({
      spaceId,
      rentalRequestId: rentalRequestId1,
      startsAt: start1,
      endsAt: end1,
      status: 'HELD',
    });

    await reservationRepo.create({
      spaceId,
      rentalRequestId: rentalRequestId2,
      startsAt: start2,
      endsAt: end2,
      status: 'CONFIRMED',
    });

    const agenda = await availabilityService.getVenueAgenda(
      venueId,
      new Date('2026-11-15T00:00:00.000Z'),
      new Date('2026-11-17T00:00:00.000Z'),
    );

    expect(agenda.length).toBe(2);
    expect(agenda.map((r) => r.id)).toBeDefined();
  });
});
