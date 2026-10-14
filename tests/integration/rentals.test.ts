import { describe, it, expect, beforeAll } from 'vitest';
import type { Express } from 'express';
import { UserRole } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infra/prisma.js';
import { seedCatalog, seedDocumentRequirements } from '../../prisma/seed.js';
import { loginAs } from '../helpers/auth.js';
import { createRentalRouter } from '../../src/modules/rentals/http/routes.js';

describe('CAR-01: Registrar solicitud de alquiler (F2.1)', () => {
  const app = createApp({
    configureRoutes: (expressApp) => {
      expressApp.use(createRentalRouter());
    },
  }) as unknown as Express;

  beforeAll(async () => {
    await seedCatalog();
    await seedDocumentRequirements();
  });

  const getValidPayload = (
    spaceId = 'space-auditorio-principal',
    dayOffset = 2,
  ) => {
    const futureDate = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
    futureDate.setHours(10, 0, 0, 0);
    const endDate = new Date(futureDate.getTime() + 4 * 60 * 60 * 1000); // 4 hours

    return {
      customer: {
        type: 'NATURAL',
        documentType: 'CC',
        documentNumber: `1088${Math.floor(100000 + Math.random() * 900000)}`,
        name: 'Carlos Pérez',
        email: 'carlos.perez@example.com',
        phone: '3109876543',
        address: 'Calle 14 # 20-30, Pereira',
      },
      spaceId,
      eventName: 'Encuentro Departamental de Danza',
      eventDescription: 'Presentación cultural abierta con agrupaciones folclóricas.',
      purpose: 'NON_LUCRATIVE',
      expectedAttendees: 150,
      startsAt: futureDate.toISOString(),
      endsAt: endDate.toISOString(),
      channel: 'WRITTEN',
      requestRadicado: 'RAD-2026-IN-0012',
    };
  };

  it('AC-01.1: registra una solicitud válida, crea cliente, reserva HELD y checklist documental', async () => {
    const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
    const payload = getValidPayload();

    const res = await agent
      .post('/solicitudes')
      .set('Accept', 'application/json')
      .set('X-CSRF-Token', csrfToken)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.rentalRequestId).toBeDefined();
    expect(res.body.status).toBe('REGISTERED');
    expect(res.body.documentCount).toBe(3); // NATURAL tiene 3 requisitos: CC, RUT, EVENT_DESC

    // Verificar en BD
    const reqDb = await prisma.rentalRequest.findUnique({
      where: { id: res.body.rentalRequestId },
      include: {
        reservations: true,
        requestDocuments: true,
        stateTransitions: true,
      },
    });

    expect(reqDb).toBeDefined();
    expect(reqDb!.status).toBe('REGISTERED');
    expect(reqDb!.requestRadicado).toBe('RAD-2026-IN-0012');
    expect(reqDb!.reservations.length).toBe(1);
    expect(reqDb!.reservations[0].status).toBe('HELD');
    expect(reqDb!.requestDocuments.length).toBe(3);
    expect(reqDb!.stateTransitions.length).toBe(1);
    expect(reqDb!.stateTransitions[0].transition).toBe('register');
  });

  it('AC-01.2: reutiliza cliente existente y actualiza sus datos de contacto sin duplicar', async () => {
    const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
    const payload1 = getValidPayload('space-auditorio-principal', 3);

    const res1 = await agent
      .post('/solicitudes')
      .set('Accept', 'application/json')
      .set('X-CSRF-Token', csrfToken)
      .send(payload1);
    expect(res1.status).toBe(201);
    const customerId1 = res1.body.customerId;

    // Registrar segunda solicitud con mismo documento pero teléfono y dirección actualizados
    const futureDate2 = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    futureDate2.setHours(10, 0, 0, 0);
    const endDate2 = new Date(futureDate2.getTime() + 3 * 60 * 60 * 1000);

    const payload2 = {
      ...payload1,
      customer: {
        ...payload1.customer,
        phone: '3119998877',
        address: 'Avenida Circunvalar # 10-20',
      },
      startsAt: futureDate2.toISOString(),
      endsAt: endDate2.toISOString(),
      requestRadicado: null,
    };

    const res2 = await agent
      .post('/solicitudes')
      .set('Accept', 'application/json')
      .set('X-CSRF-Token', csrfToken)
      .send(payload2);
    expect(res2.status).toBe(201);
    expect(res2.body.customerId).toBe(customerId1);

    const updatedCustomer = await prisma.customer.findUnique({
      where: { id: customerId1 },
    });
    expect(updatedCustomer!.phone).toBe('3119998877');
    expect(updatedCustomer!.address).toBe('Avenida Circunvalar # 10-20');
  });

  it('AC-01.3: rechaza rangos inválidos (en el pasado, fin <= inicio, < 1h, > 7 días)', async () => {
    const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);

    // 1. En el pasado
    const pastPayload = {
      ...getValidPayload(),
      startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    };
    const resPast = await agent
      .post('/solicitudes')
      .set('Accept', 'application/json')
      .set('X-CSRF-Token', csrfToken)
      .send(pastPayload);
    expect(resPast.status).toBe(400);
    expect(resPast.body.error).toContain('futuro');

    // 2. fin <= inicio
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const invertedPayload = {
      ...getValidPayload(),
      startsAt: futureDate.toISOString(),
      endsAt: new Date(futureDate.getTime() - 3600000).toISOString(),
    };
    const resInverted = await agent
      .post('/solicitudes')
      .set('Accept', 'application/json')
      .set('X-CSRF-Token', csrfToken)
      .send(invertedPayload);
    expect(resInverted.status).toBe(400);
    expect(resInverted.body.error).toContain('posterior');

    // 3. Menor a 1 hora (30 minutos)
    const shortPayload = {
      ...getValidPayload(),
      startsAt: futureDate.toISOString(),
      endsAt: new Date(futureDate.getTime() + 30 * 60 * 1000).toISOString(),
    };
    const resShort = await agent
      .post('/solicitudes')
      .set('Accept', 'application/json')
      .set('X-CSRF-Token', csrfToken)
      .send(shortPayload);
    expect(resShort.status).toBe(400);
    expect(resShort.body.error).toContain('1 hora');

    // 4. Mayor a 7 días (8 días)
    const longPayload = {
      ...getValidPayload(),
      startsAt: futureDate.toISOString(),
      endsAt: new Date(futureDate.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const resLong = await agent
      .post('/solicitudes')
      .set('Accept', 'application/json')
      .set('X-CSRF-Token', csrfToken)
      .send(longPayload);
    expect(resLong.status).toBe(400);
    expect(resLong.body.error).toContain('7 días');
  });

  it('AC-01.4: rechaza registro si el espacio ya está reservado en esa franja', async () => {
    const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
    const futureDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    futureDate.setHours(14, 0, 0, 0);
    const endDate = new Date(futureDate.getTime() + 4 * 60 * 60 * 1000);

    const payload = {
      ...getValidPayload('space-sala-multiple'),
      startsAt: futureDate.toISOString(),
      endsAt: endDate.toISOString(),
    };

    // Primera reserva exitosa
    const res1 = await agent
      .post('/solicitudes')
      .set('Accept', 'application/json')
      .set('X-CSRF-Token', csrfToken)
      .send(payload);
    expect(res1.status).toBe(201);

    // Intento con franja que solapa exactamente
    const res2 = await agent
      .post('/solicitudes')
      .set('Accept', 'application/json')
      .set('X-CSRF-Token', csrfToken)
      .send({
        ...payload,
        customer: {
          ...payload.customer,
          documentNumber: '9999999999',
        },
      });
    expect(res2.status).toBe(409);
    expect(res2.body.error).toContain('disponible');
  });

  it('AC-01.5: radicado opcional se guarda si se suministra, o queda null si no', async () => {
    const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
    const futureDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    const endDate = new Date(futureDate.getTime() + 2 * 60 * 60 * 1000);

    const payloadNoRadicado = {
      ...getValidPayload(),
      startsAt: futureDate.toISOString(),
      endsAt: endDate.toISOString(),
      requestRadicado: undefined,
    };

    const res = await agent
      .post('/solicitudes')
      .set('Accept', 'application/json')
      .set('X-CSRF-Token', csrfToken)
      .send(payloadNoRadicado);
    expect(res.status).toBe(201);

    const saved = await prisma.rentalRequest.findUnique({
      where: { id: res.body.rentalRequestId },
    });
    expect(saved!.requestRadicado).toBeNull();
  });

  it('CAR-19: rol sin permiso rentals:register recibe 403 Forbidden', async () => {
    // Probar con rol LEGAL que no puede registrar
    const { agent, csrfToken } = await loginAs(app, UserRole.LEGAL);
    const payload = getValidPayload();

    const res = await agent
      .post('/solicitudes')
      .set('Accept', 'application/json')
      .set('X-CSRF-Token', csrfToken)
      .send(payload);

    expect(res.status).toBe(403);
  });
});
