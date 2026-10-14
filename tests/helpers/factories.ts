import {
  UserRole,
  CustomerType,
  EventPurpose,
  PricingUnit,
  RentalStatus,
  ReservationStatus,
  RequestChannel,
} from '@prisma/client';
import crypto from 'node:crypto';
import { prisma } from '../../src/infra/prisma.js';
import { hashPassword } from '../../src/modules/auth/password.js';

export async function createUser(
  role: UserRole = UserRole.ADMIN_ASSISTANT,
  overrides: Record<string, unknown> = {},
) {
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword('Cambiar123!');
  return prisma.user.create({
    data: {
      id,
      email: `user_${id.slice(0, 8)}@sgec.local`,
      name: `User ${role}`,
      role,
      passwordHash,
      active: true,
      ...overrides,
    },
  });
}

export async function createVenue(overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  return prisma.venue.create({
    data: {
      id,
      name: `Centro Cultural ${id.slice(0, 6)}`,
      address: 'Carrera 7 # 12-34, Pereira',
      ...overrides,
    },
  });
}

export async function createSpace(venueId: string, overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  return prisma.space.create({
    data: {
      id,
      venueId,
      name: `Auditorio ${id.slice(0, 6)}`,
      capacity: 200,
      pricingUnit: PricingUnit.HOUR,
      active: true,
      ...overrides,
    },
  });
}

export async function createTariff(spaceId: string, overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  return prisma.tariff.create({
    data: {
      id,
      spaceId,
      purpose: EventPurpose.LUCRATIVE,
      unit: PricingUnit.HOUR,
      pricePesos: 450000,
      validFrom: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    },
  });
}

export async function createCustomer(overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  const num = Math.floor(10000000 + Math.random() * 90000000).toString();
  return prisma.customer.create({
    data: {
      id,
      type: CustomerType.NATURAL,
      documentType: 'CC',
      documentNumber: num,
      name: `Ciudadano ${id.slice(0, 6)}`,
      email: `cliente_${id.slice(0, 8)}@ejemplo.com`,
      phone: '3101234567',
      address: 'Calle 10 # 20-30, Pereira',
      ...overrides,
    },
  });
}

export async function createRentalRequest(
  customerId: string,
  spaceId: string,
  overrides: Record<string, unknown> = {},
) {
  const id = crypto.randomUUID();
  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
  const endsAt = new Date(startsAt.getTime() + 4 * 60 * 60 * 1000); // 4 hours later

  return prisma.rentalRequest.create({
    data: {
      id,
      customerId,
      spaceId,
      eventName: `Concierto ${id.slice(0, 6)}`,
      eventDescription: 'Evento cultural de prueba',
      purpose: EventPurpose.LUCRATIVE,
      expectedAttendees: 150,
      startsAt,
      endsAt,
      channel: RequestChannel.WRITTEN,
      status: RentalStatus.REGISTERED,
      ...overrides,
    },
  });
}

export async function createReservation(
  spaceId: string,
  rentalRequestId: string,
  startsAt: Date,
  endsAt: Date,
  status: ReservationStatus = ReservationStatus.HELD,
) {
  return prisma.reservation.create({
    data: {
      spaceId,
      rentalRequestId,
      startsAt,
      endsAt,
      status,
    },
  });
}
