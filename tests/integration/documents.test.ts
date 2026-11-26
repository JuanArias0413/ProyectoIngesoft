import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import {
  EventPurpose,
  PricingUnit,
  RentalStatus,
  RequestChannel,
  UserRole,
} from '@prisma/client';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infra/prisma.js';
import { cleanDatabase, disconnectDatabase } from '../helpers/db.js';
import {
  createUser,
  createVenue,
  createSpace,
  createCustomer,
  createTariff,
} from '../helpers/factories.js';
import { loginAs } from '../helpers/auth.js';
import { DocumentRenderer } from '../../src/modules/documents/documentRenderer.js';

describe('Documentos Imprimibles Integration Tests (AC-03.4, AC-05.3)', () => {
  const app = createApp();
  let renderer: DocumentRenderer;

  beforeEach(async () => {
    await cleanDatabase();
    renderer = new DocumentRenderer(prisma);
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('redirects to /login if unauthenticated request to printable document', async () => {
    const res = await request(app).get('/solicitudes/some-uuid/documentos/response_letter');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('returns 401 if unauthenticated and accepts json', async () => {
    const res = await request(app)
      .get('/solicitudes/some-uuid/documentos/response_letter')
      .set('Accept', 'application/json');
    expect(res.status).toBe(401);
  });

  it('allows access to authorized roles (ADMIN_ASSISTANT, OFFICE_HEAD, LEGAL, SECRETARY)', async () => {
    const user = await createUser(UserRole.ADMIN_ASSISTANT);
    const venue = await createVenue();
    const space = await createSpace(venue.id);
    const customer = await createCustomer();

    const rental = await prisma.rentalRequest.create({
      data: {
        customerId: customer.id,
        spaceId: space.id,
        eventName: 'Muestra Cultural',
        eventDescription: 'Exposición',
        purpose: EventPurpose.NON_LUCRATIVE,
        expectedAttendees: 50,
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        channel: RequestChannel.EMAIL,
        status: RentalStatus.REGISTERED,
        createdById: user.id,
      },
    });

    await renderer.generateResponseLetter(rental.id, user.id);

    const authorizedRoles = [
      UserRole.ADMIN_ASSISTANT,
      UserRole.OFFICE_HEAD,
      UserRole.LEGAL,
      UserRole.SECRETARY,
    ];

    for (const role of authorizedRoles) {
      const { agent } = await loginAs(app, role);
      const res = await agent.get(`/solicitudes/${rental.id}/documentos/response_letter`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('SECRETARÍA DE CULTURA DE PEREIRA');
      expect(res.text).toContain('Formato generado por SGEC — proyecto académico');
    }
  });

  it('denies access (403) to unauthorized roles (OPERATIONS_TECH, MAINTENANCE_TECH)', async () => {
    const user = await createUser(UserRole.ADMIN_ASSISTANT);
    const venue = await createVenue();
    const space = await createSpace(venue.id);
    const customer = await createCustomer();

    const rental = await prisma.rentalRequest.create({
      data: {
        customerId: customer.id,
        spaceId: space.id,
        eventName: 'Muestra Cultural',
        eventDescription: 'Exposición',
        purpose: EventPurpose.NON_LUCRATIVE,
        expectedAttendees: 50,
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        channel: RequestChannel.EMAIL,
        status: RentalStatus.REGISTERED,
        createdById: user.id,
      },
    });

    await renderer.generateResponseLetter(rental.id, user.id);

    const unauthorizedRoles = [UserRole.OPERATIONS_TECH, UserRole.MAINTENANCE_TECH];

    for (const role of unauthorizedRoles) {
      const { agent } = await loginAs(app, role);
      const res = await agent
        .get(`/solicitudes/${rental.id}/documentos/response_letter`)
        .set('Accept', 'application/json');
      expect(res.status).toBe(403);
    }
  });

  it('returns 400 for invalid document kind', async () => {
    const { agent } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
    const res = await agent
      .get('/solicitudes/any-uuid/documentos/invalid_kind')
      .set('Accept', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Tipo de documento no válido');
  });

  it('returns 404 when document has not been generated yet', async () => {
    const { agent } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
    const venue = await createVenue();
    const space = await createSpace(venue.id);
    const customer = await createCustomer();

    const rental = await prisma.rentalRequest.create({
      data: {
        customerId: customer.id,
        spaceId: space.id,
        eventName: 'Evento sin documentos aún',
        eventDescription: 'Desc',
        purpose: EventPurpose.NON_LUCRATIVE,
        expectedAttendees: 50,
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        channel: RequestChannel.EMAIL,
        status: RentalStatus.REGISTERED,
      },
    });

    const res = await agent
      .get(`/solicitudes/${rental.id}/documentos/contract`)
      .set('Accept', 'application/json');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('No se encontró un documento generado');
  });

  it('renders printable A4 page with window.print() button, CSS print rules and specific version support', async () => {
    const { agent, user } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
    const venue = await createVenue({ name: 'Lucy Tejada' });
    const space = await createSpace(venue.id, { name: 'Auditorio' });
    const tariff = await createTariff(space.id, { pricePesos: 200000, unit: PricingUnit.HOUR });
    const customer = await createCustomer({ name: 'Juan Pérez' });

    const rental = await prisma.rentalRequest.create({
      data: {
        customerId: customer.id,
        spaceId: space.id,
        eventName: 'Concierto de Jazz',
        eventDescription: 'Música en vivo',
        purpose: EventPurpose.LUCRATIVE,
        expectedAttendees: 100,
        startsAt: new Date('2026-11-15T13:00:00Z'),
        endsAt: new Date('2026-11-15T16:00:00Z'),
        channel: RequestChannel.EMAIL,
        status: RentalStatus.CONTRACT_DRAFTED,
        quotedTariffId: tariff.id,
        quotedAmountPesos: 600000,
        createdById: user.id,
      },
    });

    // Version 1
    await renderer.generatePriorStudyAndContract(rental.id, 1, user.id);

    // Version 2 with updated object
    await prisma.contract.create({
      data: {
        rentalRequestId: rental.id,
        object: 'Objeto actualizado en versión 2',
        valuePesos: 600000,
      },
    });
    await renderer.generatePriorStudyAndContract(rental.id, 2, user.id);

    // 1. By default, returns latest version (v2)
    const resLatest = await agent.get(`/solicitudes/${rental.id}/documentos/contract`);
    expect(resLatest.status).toBe(200);
    expect(resLatest.headers['content-type']).toContain('text/html');
    expect(resLatest.text).toContain('Objeto actualizado en versión 2');
    expect(resLatest.text).toContain('Versión documental 2');

    // Verify print styling & toolbar
    expect(resLatest.text).toContain('@media print');
    expect(resLatest.text).toContain('window.print()');
    expect(resLatest.text).toContain('no-print');
    expect(resLatest.text).toContain('size: A4');
    expect(resLatest.text).toContain('margin: 2cm');
    expect(resLatest.text).toContain('Times New Roman');

    // 2. Querying specific version ?version=1 returns v1
    const resV1 = await agent.get(`/solicitudes/${rental.id}/documentos/contract?version=1`);
    expect(resV1.status).toBe(200);
    expect(resV1.text).toContain('Versión documental 1');

    // 3. Prior study route
    const resStudy = await agent.get(`/solicitudes/${rental.id}/documentos/prior_study`);
    expect(resStudy.status).toBe(200);
    expect(resStudy.text).toContain('ESTUDIO PREVIO — ARRENDAMIENTO DE ESPACIO CULTURAL');
  });
});
