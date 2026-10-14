import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { Application, Express } from 'express';
import request from 'supertest';
import { UserRole, CustomerType, RentalStatus, ReservationStatus } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infra/prisma.js';
import { seedCatalog, seedDocumentRequirements, seedUsers } from '../../prisma/seed.js';
import { loginAs } from '../helpers/auth.js';
import { cleanDatabase } from '../helpers/db.js';
import { createRentalRouter } from '../../src/modules/rentals/http/routes.js';
import {
  createRentalInState,
  assertForbidden,
} from '../helpers/rentalHelper.js';

describe('SGEC Release 1.0 — Rental Lifecycle & Flow Integration (rentalFlow.test.ts)', () => {
  let app: Application;

  beforeAll(async () => {
    app = createApp({
      configureRoutes: (expressApp) => {
        expressApp.use(createRentalRouter());
      },
    }) as unknown as Express;

    await cleanDatabase();
    await seedUsers();
    await seedCatalog();
    await seedDocumentRequirements();
  });

  beforeEach(async () => {
    // Truncate only transactional tables, preserving users and catalog
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE 
        "StateTransition",
        "GeneratedDocument",
        "LegalReview",
        "Payment",
        "Contract",
        "RequestDocument",
        "Reservation",
        "RentalRequest",
        "Customer"
      CASCADE;
    `);
  });

  const buildValidRegistrationPayload = (
    spaceId = 'space-auditorio-principal',
    dayOffset = 2,
    customerType: CustomerType = CustomerType.NATURAL,
  ) => {
    const futureDate = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
    futureDate.setHours(10, 0, 0, 0);
    const endDate = new Date(futureDate.getTime() + 4 * 60 * 60 * 1000); // 4 hours

    const rand = Math.floor(100000 + Math.random() * 900000);

    return {
      customer: {
        type: customerType,
        documentType: customerType === CustomerType.NATURAL ? 'CC' : 'NIT',
        documentNumber: `1088${rand}`,
        name: customerType === CustomerType.NATURAL ? 'Carlos Pérez' : 'Corporación Cultural Pereira',
        email: `cliente_${rand}@ejemplo.com`,
        phone: '3109876543',
        address: 'Calle 14 # 20-30, Pereira',
        legalRepresentative: customerType === CustomerType.LEGAL ? 'Representante Legal Demo' : null,
      },
      spaceId,
      eventName: 'Encuentro Departamental de Cultura',
      eventDescription: 'Presentación cultural abierta con agrupaciones folclóricas.',
      purpose: 'NON_LUCRATIVE' as const,
      expectedAttendees: 150,
      startsAt: futureDate.toISOString(),
      endsAt: endDate.toISOString(),
      channel: 'WRITTEN' as const,
      requestRadicado: 'RAD-2026-IN-0012',
    };
  };

  // =========================================================================
  // CAR-01: Registro de solicitud (AC-01.1 a AC-01.5)
  // =========================================================================
  describe('CAR-01: Registro de solicitud', () => {
    it('AC-01.1: auxiliar registra solicitud válida → estado REGISTERED, reserva HELD y checklist documental', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const payload = buildValidRegistrationPayload('space-auditorio-principal', 60, CustomerType.NATURAL);

      const res = await agent
        .post('/solicitudes')
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.rentalRequestId).toBeDefined();
      expect(res.body.status).toBe('REGISTERED');
      expect(res.body.documentCount).toBe(3); // NATURAL: CC, RUT, EVENT_DESC

      // Verificación en base de datos
      const reqDb = await prisma.rentalRequest.findUnique({
        where: { id: res.body.rentalRequestId },
        include: {
          reservations: true,
          requestDocuments: true,
          stateTransitions: true,
        },
      });

      expect(reqDb).toBeDefined();
      expect(reqDb!.status).toBe(RentalStatus.REGISTERED);
      expect(reqDb!.requestRadicado).toBe('RAD-2026-IN-0012');
      expect(reqDb!.reservations).toHaveLength(1);
      expect(reqDb!.reservations[0].status).toBe(ReservationStatus.HELD);
      expect(reqDb!.requestDocuments).toHaveLength(3);
      expect(reqDb!.stateTransitions).toHaveLength(1);
      expect(reqDb!.stateTransitions[0].transition).toBe('register');
    });

    it('AC-01.2: misma cédula del cliente → reutiliza cliente (no duplica) y actualiza contacto', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const payload1 = buildValidRegistrationPayload('space-auditorio-principal', 61);

      const res1 = await agent
        .post('/solicitudes')
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send(payload1);
      expect(res1.status).toBe(201);
      const customerId1 = res1.body.customerId;

      // Segunda solicitud con misma cédula pero nuevo teléfono y dirección
      const futureDate2 = new Date(Date.now() + 62 * 24 * 60 * 60 * 1000);
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

    it('AC-01.3: rango horario inválido (en el pasado, fin <= inicio, < 1h, > 7 días) → 400 con mensaje explicativo', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);

      // 1. En el pasado
      const pastPayload = {
        ...buildValidRegistrationPayload(),
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
        ...buildValidRegistrationPayload(),
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

      // 3. Menor a 1 hora
      const shortPayload = {
        ...buildValidRegistrationPayload(),
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

      // 4. Mayor a 7 días
      const longPayload = {
        ...buildValidRegistrationPayload(),
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

    it('AC-01.4: rango solapado con reserva activa del mismo espacio → 409 conflicto', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const futureDate = new Date(Date.now() + 70 * 24 * 60 * 60 * 1000);
      futureDate.setHours(14, 0, 0, 0);
      const endDate = new Date(futureDate.getTime() + 4 * 60 * 60 * 1000);

      const payload = {
        ...buildValidRegistrationPayload('space-sala-multiple'),
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

      // Intento solapado
      const res2 = await agent
        .post('/solicitudes')
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send({
          ...payload,
          customer: {
            ...payload.customer,
            documentNumber: '9988776655',
          },
        });
      expect(res2.status).toBe(409);
      expect(res2.body.error).toContain('disponible');
    });

    it('AC-01.5: con radicado guarda; sin radicado no falla y queda nulo', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const futureDate = new Date(Date.now() + 71 * 24 * 60 * 60 * 1000);
      const endDate = new Date(futureDate.getTime() + 2 * 60 * 60 * 1000);

      const payloadNoRadicado = {
        ...buildValidRegistrationPayload(),
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
  });

  // =========================================================================
  // CAR-02: Disponibilidad y Agenda (AC-02.3)
  // =========================================================================
  describe('CAR-02: Disponibilidad y Agenda', () => {
    it('AC-02.3: reservas RELEASED no bloquean; franjas contiguas tampoco', async () => {
      // 1. Crear reserva CANCELADA (status RELEASED)
      const baseStartsAt = new Date(Date.now() + 66 * 24 * 60 * 60 * 1000);
      baseStartsAt.setHours(8, 0, 0, 0);
      const baseEndsAt = new Date(baseStartsAt.getTime() + 4 * 60 * 60 * 1000); // 8:00 a 12:00

      const cancelledRental = await createRentalInState(RentalStatus.CANCELLED, {
        spaceId: 'space-auditorio-principal',
        startsAt: baseStartsAt,
        endsAt: baseEndsAt,
      });

      expect(cancelledRental.reservation.status).toBe(ReservationStatus.RELEASED);

      // Ahora registrar solicitud en la misma franja exacta de la reserva liberada
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const payloadOnReleased = {
        ...buildValidRegistrationPayload('space-auditorio-principal'),
        startsAt: baseStartsAt.toISOString(),
        endsAt: baseEndsAt.toISOString(),
      };

      const resReleased = await agent
        .post('/solicitudes')
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send(payloadOnReleased);
      expect(resReleased.status).toBe(201);

      // 2. Franjas contiguas: termina a las 12:00, la siguiente empieza exactamente a las 12:00
      const contiguousStartsAt = baseEndsAt; // 12:00
      const contiguousEndsAt = new Date(contiguousStartsAt.getTime() + 2 * 60 * 60 * 1000); // 14:00

      const payloadContiguous = {
        ...buildValidRegistrationPayload('space-auditorio-principal'),
        startsAt: contiguousStartsAt.toISOString(),
        endsAt: contiguousEndsAt.toISOString(),
      };

      const resContiguous = await agent
        .post('/solicitudes')
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send(payloadContiguous);
      expect(resContiguous.status).toBe(201);
    });
  });

  // =========================================================================
  // CAR-03: Oficio de respuesta (AC-03.1, AC-03.3, AC-03.4)
  // =========================================================================
  describe('CAR-03: Oficio de respuesta', () => {
    it('AC-03.1 & AC-03.4: T2 respond calcula valor, congela tarifa y genera oficio imprimible', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);

      // Crear solicitud en estado REGISTERED
      const registered = await createRentalInState(RentalStatus.REGISTERED, {
        spaceId: 'space-auditorio-principal',
      });

      const res = await agent
        .post(`/solicitudes/${registered.rental.id}/transiciones/respond`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send({ responseRadicado: 'RAD-RESP-2026-OF-0089' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('RESPONDED');
      expect(res.body.quotedAmountPesos).toBeGreaterThan(0);
      expect(res.body.responseRadicado).toBe('RAD-RESP-2026-OF-0089');

      // Verificar en BD
      const updatedReq = await prisma.rentalRequest.findUnique({
        where: { id: registered.rental.id },
      });
      expect(updatedReq!.status).toBe(RentalStatus.RESPONDED);
      expect(updatedReq!.quotedAmountPesos).toBe(res.body.quotedAmountPesos);
      expect(updatedReq!.responseRadicado).toBe('RAD-RESP-2026-OF-0089');

      // AC-03.4: Verificar que el oficio es consultable e imprimible
      const docRes = await agent.get(`/solicitudes/${registered.rental.id}/documentos/RESPONSE_LETTER`);
      expect(docRes.status).toBe(200);
      expect(docRes.text).toContain('RAD-RESP-2026-OF-0089');
      expect(docRes.text).toContain('Oficio de Respuesta');
    });

    it('AC-03.2: Oficio contiene requisitos según cliente, valor en letras y números, y datos de consignación', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);

      const registered = await createRentalInState(RentalStatus.REGISTERED, {
        spaceId: 'space-auditorio-principal',
      });

      await agent
        .post(`/solicitudes/${registered.rental.id}/transiciones/respond`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send({ responseRadicado: 'RAD-RESP-2026-OF-0099' });

      const docRes = await agent.get(`/solicitudes/${registered.rental.id}/documentos/RESPONSE_LETTER`);
      expect(docRes.status).toBe(200);

      const html = docRes.text;
      // Destinatario y contacto
      expect(html).toContain(registered.customer.name);
      expect(html).toContain(registered.customer.documentNumber);
      // Asunto y radicado
      expect(html).toContain('RAD-RESP-2026-OF-0099');
      expect(html).toContain('Respuesta a solicitud de alquiler');
      // Escenario
      expect(html).toContain('Auditorio Principal');
      // Requisitos documentales
      expect(html).toContain('Documentos exigidos para el trámite contractual');
      expect(html).toContain('Documento de identidad');
      // Valor en letras y números
      expect(html).toContain('Valor en Letras:');
      expect(html).toContain('pesos M/CTE');
      // Datos de consignación
      expect(html).toContain('Bancolombia');
      expect(html).toContain('Cuenta de Ahorros');
      // Firma tipográfica
      expect(html).toContain('Jefe de la Oficina de Administración de Escenarios y Bienes Culturales');
    });

    it('AC-03.3: T2 rechaza si no hay radicado con 400', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const registered = await createRentalInState(RentalStatus.REGISTERED);

      const res = await agent
        .post(`/solicitudes/${registered.rental.id}/transiciones/respond`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send({ responseRadicado: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('radicado');
    });
  });

  // =========================================================================
  // CAR-04: Checklist de documentos (AC-04.1)
  // =========================================================================
  describe('CAR-04: Checklist de documentos', () => {
    it('AC-04.1: checklist de documentos generado al registrar según tipo de cliente', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);

      // 1. Cliente Persona Natural
      const naturalPayload = buildValidRegistrationPayload('space-auditorio-principal', 67, CustomerType.NATURAL);
      const naturalRes = await agent
        .post('/solicitudes')
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send(naturalPayload);

      expect(naturalRes.status).toBe(201);
      const naturalDocs = await prisma.requestDocument.findMany({
        where: { rentalRequestId: naturalRes.body.rentalRequestId },
      });
      const naturalCodes = naturalDocs.map((d) => d.requirementCode).sort();
      expect(naturalCodes).toEqual(['CC', 'EVENT_DESC', 'RUT'].sort());

      // 2. Cliente Persona Jurídica
      const legalPayload = buildValidRegistrationPayload('space-auditorio-principal', 68, CustomerType.LEGAL);
      const legalRes = await agent
        .post('/solicitudes')
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send(legalPayload);

      expect(legalRes.status).toBe(201);
      const legalDocs = await prisma.requestDocument.findMany({
        where: { rentalRequestId: legalRes.body.rentalRequestId },
      });
      const legalCodes = legalDocs.map((d) => d.requirementCode).sort();
      expect(legalCodes).toEqual(['CERT_EXISTENCE', 'EVENT_DESC', 'REP_DOC', 'RUT'].sort());
    });

    it('AC-04.2: auxiliar marca documento recibido, adjunta archivo y lo verifica', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const responded = await createRentalInState(RentalStatus.RESPONDED);
      const rentalId = responded.rental.id;

      // 1. Marcar como recibido
      const resRecibir = await agent
        .post(`/solicitudes/${rentalId}/documentos/CC/recibir`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send({ notes: 'Recibido copia física en ventanilla' });

      expect(resRecibir.status).toBe(200);
      expect(resRecibir.body.document.receivedAt).toBeDefined();

      const docDb1 = await prisma.requestDocument.findFirst({
        where: { rentalRequestId: rentalId, requirementCode: 'CC' },
      });
      expect(docDb1!.receivedAt).not.toBeNull();
      expect(docDb1!.notes).toBe('Recibido copia física en ventanilla');

      // 2. Adjuntar archivo válido (PDF)
      const pdfBuffer = Buffer.from('%PDF-1.4 test document content');
      const resArchivo = await agent
        .post(`/solicitudes/${rentalId}/documentos/CC/archivo`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .attach('archivo', pdfBuffer, { filename: 'cedula_carlos.pdf', contentType: 'application/pdf' });

      expect(resArchivo.status).toBe(200);
      expect(resArchivo.body.fileKey).toBeDefined();

      const docDb2 = await prisma.requestDocument.findFirst({
        where: { rentalRequestId: rentalId, requirementCode: 'CC' },
      });
      expect(docDb2!.fileKey).toBe(resArchivo.body.fileKey);

      // 3. Verificar documento
      const resVerificar = await agent
        .post(`/solicitudes/${rentalId}/documentos/CC/verificar`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send();

      expect(resVerificar.status).toBe(200);
      expect(resVerificar.body.document.verifiedAt).toBeDefined();

      const docDb3 = await prisma.requestDocument.findFirst({
        where: { rentalRequestId: rentalId, requirementCode: 'CC' },
      });
      expect(docDb3!.verifiedAt).not.toBeNull();
      expect(docDb3!.verifiedById).toBeDefined();
    });

    it('AC-04.3: se rechazan archivos de tipo no permitido o que superan 5 MB con código 400', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const responded = await createRentalInState(RentalStatus.RESPONDED);
      const rentalId = responded.rental.id;

      // 1. Tipo no permitido (ej. archivo ejecutable o texto plano)
      const badBuffer = Buffer.from('echo hello world');
      const resBadType = await agent
        .post(`/solicitudes/${rentalId}/documentos/CC/archivo`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .attach('archivo', badBuffer, { filename: 'script.sh', contentType: 'text/plain' });

      expect(resBadType.status).toBe(400);
      expect(resBadType.body.error).toContain('Tipo de archivo no permitido');

      // 2. Tamaño superior a 5 MB (5.2 MB)
      const hugeBuffer = Buffer.alloc(5.2 * 1024 * 1024, 0);
      const resHuge = await agent
        .post(`/solicitudes/${rentalId}/documentos/CC/archivo`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .attach('archivo', hugeBuffer, { filename: 'enorme.pdf', contentType: 'application/pdf' });

      expect(resHuge.status).toBe(400);
      expect(resHuge.body.error).toContain('5 MB');
    });

    it('AC-04.4: T3 verifyDocuments falla con 400 si faltan obligatorios; pasa a DOCUMENTS_VERIFIED cuando todos están verificados', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const responded = await createRentalInState(RentalStatus.RESPONDED, {
        customerType: CustomerType.NATURAL,
      });
      const rentalId = responded.rental.id;

      // Verificar solo CC, dejando RUT y EVENT_DESC sin verificar
      await agent
        .post(`/solicitudes/${rentalId}/documentos/CC/verificar`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send();

      // Intento de transición T3 verifyDocuments incompleto
      const resIncomplete = await agent
        .post(`/solicitudes/${rentalId}/transiciones/verifyDocuments`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send();

      expect(resIncomplete.status).toBe(400);
      expect(resIncomplete.body.error).toContain('obligatorios');

      const reqDbAfterFail = await prisma.rentalRequest.findUnique({ where: { id: rentalId } });
      expect(reqDbAfterFail!.status).toBe(RentalStatus.RESPONDED);

      // Ahora verificar los documentos restantes
      await agent
        .post(`/solicitudes/${rentalId}/documentos/RUT/verificar`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send();

      await agent
        .post(`/solicitudes/${rentalId}/documentos/EVENT_DESC/verificar`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send();

      // Intento de transición T3 completo
      const resComplete = await agent
        .post(`/solicitudes/${rentalId}/transiciones/verifyDocuments`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send();

      expect(resComplete.status).toBe(200);
      expect(resComplete.body.status).toBe(RentalStatus.DOCUMENTS_VERIFIED);

      // Verificar en BD el estado y la transición registrada
      const reqDbSuccess = await prisma.rentalRequest.findUnique({
        where: { id: rentalId },
        include: { stateTransitions: true },
      });
      expect(reqDbSuccess!.status).toBe(RentalStatus.DOCUMENTS_VERIFIED);
      expect(
        reqDbSuccess!.stateTransitions.some((t) => t.transition === 'verifyDocuments' && t.toStatus === 'DOCUMENTS_VERIFIED'),
      ).toBe(true);
    });

    it('AC-04.5: los archivos solo se descargan con sesión y permiso (GET /archivos/:key)', async () => {
      const { agent: assistantAgent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const responded = await createRentalInState(RentalStatus.RESPONDED);
      const rentalId = responded.rental.id;

      // Subir archivo de prueba
      const fileContent = 'Contenido de prueba confidencial para descarga';
      const uploadRes = await assistantAgent
        .post(`/solicitudes/${rentalId}/documentos/CC/archivo`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .attach('archivo', Buffer.from(fileContent), { filename: 'cedula.pdf', contentType: 'application/pdf' });

      expect(uploadRes.status).toBe(200);
      const fileKey = uploadRes.body.fileKey;
      expect(fileKey).toBeDefined();

      // 1. Descarga con sesión autorizada (ADMIN_ASSISTANT) → 200 OK
      const resDownloadAuth = await assistantAgent.get(`/archivos/${fileKey}`);
      expect(resDownloadAuth.status).toBe(200);
      expect(resDownloadAuth.body.toString()).toBe(fileContent);

      // 2. Descarga con rol sin permiso (OPERATIONS_TECH) → 403 Forbidden
      const { agent: opsAgent } = await loginAs(app, UserRole.OPERATIONS_TECH);
      const resOps = await opsAgent.get(`/archivos/${fileKey}`);
      assertForbidden(resOps);

      // 3. Descarga sin autenticación:
      // a) Solicitud API/JSON → 401 Unauthorized
      const unauthJsonRes = await request(app)
        .get(`/archivos/${fileKey}`)
        .set('Accept', 'application/json');
      expect(unauthJsonRes.status).toBe(401);

      // b) Navegador HTML → 302 Redirección a /login
      const unauthHtmlRes = await request(app).get(`/archivos/${fileKey}`);
      expect(unauthHtmlRes.status).toBe(302);
      expect(unauthHtmlRes.headers.location).toBe('/login');
    });
  });

  // =========================================================================
  // Fábrica de Estados del Ciclo de Vida (createRentalInState)
  // =========================================================================
  describe('Ciclo de vida completo vía helper createRentalInState', () => {
    it('crea solicitudes en todos los 10 estados con registros consistentes', async () => {
      // 1. REGISTERED
      const s1 = await createRentalInState(RentalStatus.REGISTERED);
      expect(s1.rental.status).toBe(RentalStatus.REGISTERED);
      expect(s1.reservation.status).toBe(ReservationStatus.HELD);

      // 2. RESPONDED
      const s2 = await createRentalInState(RentalStatus.RESPONDED);
      expect(s2.rental.status).toBe(RentalStatus.RESPONDED);
      expect(s2.rental.quotedAmountPesos).toBeGreaterThan(0);
      expect(s2.generatedDocs.some((d) => d.kind === 'RESPONSE_LETTER')).toBe(true);

      // 3. DOCUMENTS_VERIFIED
      const s3 = await createRentalInState(RentalStatus.DOCUMENTS_VERIFIED);
      expect(s3.rental.status).toBe(RentalStatus.DOCUMENTS_VERIFIED);

      // 4. CONTRACT_DRAFTED
      const s4 = await createRentalInState(RentalStatus.CONTRACT_DRAFTED);
      expect(s4.rental.status).toBe(RentalStatus.CONTRACT_DRAFTED);
      expect(s4.contract).toBeDefined();

      // 5. PAID
      const s5 = await createRentalInState(RentalStatus.PAID);
      expect(s5.rental.status).toBe(RentalStatus.PAID);
      expect(s5.payment).toBeDefined();

      // 6. LEGAL_REVIEW
      const s6 = await createRentalInState(RentalStatus.LEGAL_REVIEW);
      expect(s6.rental.status).toBe(RentalStatus.LEGAL_REVIEW);

      // 7. RETURNED_BY_LEGAL
      const s7 = await createRentalInState(RentalStatus.RETURNED_BY_LEGAL);
      expect(s7.rental.status).toBe(RentalStatus.RETURNED_BY_LEGAL);
      expect(s7.legalReview!.decision).toBe('RETURNED');

      // 8. PENDING_SIGNATURE
      const s8 = await createRentalInState(RentalStatus.PENDING_SIGNATURE);
      expect(s8.rental.status).toBe(RentalStatus.PENDING_SIGNATURE);
      expect(s8.legalReview!.decision).toBe('APPROVED');

      // 9. LEGALIZED
      const s9 = await createRentalInState(RentalStatus.LEGALIZED);
      expect(s9.rental.status).toBe(RentalStatus.LEGALIZED);
      expect(s9.reservation.status).toBe(ReservationStatus.CONFIRMED);
      expect(s9.contract!.number).toMatch(/^ARR-\d{4}-\d{4}$/);

      // 10. CANCELLED
      const s10 = await createRentalInState(RentalStatus.CANCELLED);
      expect(s10.rental.status).toBe(RentalStatus.CANCELLED);
      expect(s10.reservation.status).toBe(ReservationStatus.RELEASED);
    });
  });

  // =========================================================================
  // CAR-19: Roles, Autorización y Seguridad (AC-19.1 a AC-19.3)
  // =========================================================================
  describe('CAR-19: Roles y Seguridad en el Servidor', () => {
    it('AC-19.2: usuario sin permiso recibe 403 Forbidden al invocar rutas protegidas', async () => {
      // 1. Rol LEGAL intentando registrar solicitud
      const { agent: legalAgent, csrfToken: legalCsrf } = await loginAs(app, UserRole.LEGAL);
      const resRegister = await legalAgent
        .post('/solicitudes')
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', legalCsrf)
        .send(buildValidRegistrationPayload());

      assertForbidden(resRegister);

      // 2. Rol SECRETARY intentando responder solicitud
      const { agent: secAgent, csrfToken: secCsrf } = await loginAs(app, UserRole.SECRETARY);
      const reg = await createRentalInState(RentalStatus.REGISTERED);
      const resRespond = await secAgent
        .post(`/solicitudes/${reg.rental.id}/transiciones/respond`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', secCsrf)
        .send({ responseRadicado: 'RAD-SECRETARY-UNAUTHORIZED' });

      assertForbidden(resRespond);
    });

    it('AC-19.3: peticiones POST sin token CSRF son rechazadas con código 403', async () => {
      const { agent } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const payload = buildValidRegistrationPayload();

      // POST sin token CSRF
      const res = await agent
        .post('/solicitudes')
        .set('Accept', 'application/json')
        .send(payload);

      expect(res.status).toBe(403);
    });
  });
});
