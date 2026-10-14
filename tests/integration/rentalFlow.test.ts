import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { Application, Express } from 'express';
import request from 'supertest';
import { UserRole, CustomerType, RentalStatus, ReservationStatus } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infra/prisma.js';
import { seedCatalog, seedDocumentRequirements, seedUsers } from '../../prisma/seed.js';
import { loginAs } from '../helpers/auth.js';
import { cleanDatabase } from '../helpers/db.js';
import {
  createRentalInState,
  assertForbidden,
} from '../helpers/rentalHelper.js';

describe('SGEC Release 1.0 — Rental Lifecycle & Flow Integration (rentalFlow.test.ts)', () => {
  let app: Application;

  beforeAll(async () => {
    app = createApp() as unknown as Express;

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
  // CAR-05: Estudio Previo y Contrato (AC-05.1 a AC-05.3, T4 draftContract)
  // =========================================================================
  describe('CAR-05: Elaboración, Edición y Versiones de Contrato', () => {
    it('AC-05.1: desde DOCUMENTS_VERIFIED, el auxiliar elabora el contrato (POST /solicitudes/:id/transiciones/draftContract) generando estudio previo y minuta v1', async () => {
      const { agent: assistantAgent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const verified = await createRentalInState(RentalStatus.DOCUMENTS_VERIFIED);
      const rentalId = verified.rental.id;

      const payload = {
        object: 'Arrendamiento temporal del auditorio para conferencia magistral sobre patrimonio pereirano.',
        additionalClauses: 'El arrendatario asume la responsabilidad total de los equipos audiovisuales suministrados.',
      };

      const res = await assistantAgent
        .post(`/solicitudes/${rentalId}/transiciones/draftContract`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(RentalStatus.CONTRACT_DRAFTED);
      expect(res.body.contract).toBeDefined();
      expect(res.body.contract.object).toBe(payload.object);
      expect(res.body.contract.additionalClauses).toBe(payload.additionalClauses);
      expect(res.body.contract.valuePesos).toBe(verified.rental.quotedAmountPesos);

      // Verificar persistencia en base de datos
      const rentalDb = await prisma.rentalRequest.findUnique({
        where: { id: rentalId },
        include: { contract: true, stateTransitions: true, generatedDocuments: true },
      });

      expect(rentalDb!.status).toBe(RentalStatus.CONTRACT_DRAFTED);
      expect(rentalDb!.contract).toBeDefined();
      expect(rentalDb!.contract!.object).toBe(payload.object);
      expect(rentalDb!.contract!.additionalClauses).toBe(payload.additionalClauses);
      expect(rentalDb!.contract!.valuePesos).toBe(verified.rental.quotedAmountPesos);

      // Transición registrada
      expect(
        rentalDb!.stateTransitions.some(
          (t) => t.transition === 'draftContract' && t.toStatus === 'CONTRACT_DRAFTED',
        ),
      ).toBe(true);

      // Documentos generados v1 (estudio previo y contrato)
      const priorStudyDocs = rentalDb!.generatedDocuments.filter(
        (d) => d.kind === 'PRIOR_STUDY' && d.version === 1,
      );
      const contractDocs = rentalDb!.generatedDocuments.filter(
        (d) => d.kind === 'CONTRACT' && d.version === 1,
      );
      expect(priorStudyDocs.length).toBe(1);
      expect(contractDocs.length).toBe(1);
      expect(contractDocs[0].html).toContain(payload.object);
      expect(contractDocs[0].html).toContain(payload.additionalClauses);

      // Precondición: rechaza si la solicitud no está en DOCUMENTS_VERIFIED (409 Conflict por transición inválida)
      const registered = await createRentalInState(RentalStatus.REGISTERED);
      const resInvalidState = await assistantAgent
        .post(`/solicitudes/${registered.rental.id}/transiciones/draftContract`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send(payload);
      expect(resInvalidState.status).toBe(409);

      // RBAC: rechaza si un rol no autorizado intenta elaborar contrato
      const { agent: legalAgent, csrfToken: legalCsrf } = await loginAs(app, UserRole.LEGAL);
      const verified2 = await createRentalInState(RentalStatus.DOCUMENTS_VERIFIED);
      const resForbidden = await legalAgent
        .post(`/solicitudes/${verified2.rental.id}/transiciones/draftContract`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', legalCsrf)
        .send(payload);
      assertForbidden(resForbidden);
    });

    it('AC-05.2: el auxiliar puede editar object y additionalClauses antes de enviar a revisión, creando nuevas versiones incrementales', async () => {
      const { agent: assistantAgent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const verified = await createRentalInState(RentalStatus.DOCUMENTS_VERIFIED);
      const rentalId = verified.rental.id;

      // Elaborar versión 1
      await assistantAgent
        .post(`/solicitudes/${rentalId}/transiciones/draftContract`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send({
          object: 'Objeto inicial versión 1',
          additionalClauses: 'Cláusula inicial versión 1',
        });

      // 1. Primera edición (versión 2)
      const update1 = {
        object: 'Objeto contractual modificado y ajustado con especificaciones técnicas.',
        additionalClauses: 'El arrendatario se compromete a no fijar afiches en paredes patrimoniales.',
      };

      const res1 = await assistantAgent
        .post(`/solicitudes/${rentalId}/contrato`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send(update1);

      expect(res1.status).toBe(200);
      expect(res1.body.version).toBe(2);
      expect(res1.body.contract.object).toBe(update1.object);
      expect(res1.body.contract.additionalClauses).toBe(update1.additionalClauses);

      // Verificar en BD versión 2 generada
      const docsV2 = await prisma.generatedDocument.findMany({
        where: { rentalRequestId: rentalId, version: 2 },
      });
      expect(docsV2.length).toBe(2); // PRIOR_STUDY y CONTRACT
      const contractV2 = docsV2.find((d) => d.kind === 'CONTRACT');
      expect(contractV2!.html).toContain(update1.object);
      expect(contractV2!.html).toContain(update1.additionalClauses);

      // 2. Segunda edición con PATCH (versión 3)
      const update2 = {
        object: 'Objeto contractual v3 definitivo con aval de planeación cultural.',
        additionalClauses: 'Se prohíbe el uso de pirotecnia y confeti metálico en el recinto.',
      };

      const res2 = await assistantAgent
        .patch(`/solicitudes/${rentalId}/contrato`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send(update2);

      expect(res2.status).toBe(200);
      expect(res2.body.version).toBe(3);
      expect(res2.body.contract.object).toBe(update2.object);

      // 3. Intento de edición cuando la solicitud ya está en LEGAL_REVIEW (debe ser rechazado)
      const inReview = await createRentalInState(RentalStatus.LEGAL_REVIEW);
      const resBlocked = await assistantAgent
        .post(`/solicitudes/${inReview.rental.id}/contrato`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send({ object: 'Intento no permitido en revisión' });
      expect(resBlocked.status).toBe(400);
      expect(resBlocked.body.error).toMatch(/revisión jurídica|estado actual/i);
    });

    it('AC-05.3: estudio previo y contrato son imprimibles (A4) y accesibles vía GET /solicitudes/:id/documentos/:kind', async () => {
      const { agent: assistantAgent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const verified = await createRentalInState(RentalStatus.DOCUMENTS_VERIFIED);
      const rentalId = verified.rental.id;

      // Elaborar contrato real usando DocumentRenderer
      await assistantAgent
        .post(`/solicitudes/${rentalId}/transiciones/draftContract`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send({
          object: 'Arrendamiento de espacio para concierto de cámara de música andina colombiana.',
          additionalClauses: 'Se prohíbe el ingreso de bebidas alcohólicas y alimentos perecederos al escenario.',
        });

      // 1. Ver Estudio Previo (A4)
      const resPriorStudy = await assistantAgent.get(`/solicitudes/${rentalId}/documentos/PRIOR_STUDY`);
      expect(resPriorStudy.status).toBe(200);
      expect(resPriorStudy.headers['content-type']).toContain('text/html');
      expect(resPriorStudy.text).toContain('ESTUDIO PREVIO');
      expect(resPriorStudy.text).toContain('A4');
      expect(resPriorStudy.text).toContain('@page');

      // 2. Ver Contrato Minuta (A4)
      const resContract = await assistantAgent.get(`/solicitudes/${rentalId}/documentos/CONTRACT`);
      expect(resContract.status).toBe(200);
      expect(resContract.headers['content-type']).toContain('text/html');
      expect(resContract.text).toContain('CONTRATO DE ARRENDAMIENTO DE ESPACIO CULTURAL');
      expect(resContract.text).toContain('A4');
      expect(resContract.text).toContain('CLÁUSULA PRIMERA');
      expect(resContract.text).toContain('CLÁUSULA SEGUNDA');
      expect(resContract.text).toContain('CLÁUSULA TERCERA');

      // 3. Consulta de versión específica (?version=1)
      const resV1 = await assistantAgent.get(`/solicitudes/${rentalId}/documentos/CONTRACT?version=1`);
      expect(resV1.status).toBe(200);
      expect(resV1.text).toContain('Versión documental 1');

      // 4. Tipo de documento inválido devuelve 400
      const resInvalidDoc = await assistantAgent.get(`/solicitudes/${rentalId}/documentos/INVENTARIO_BODEGA`);
      expect(resInvalidDoc.status).toBe(400);

      // 5. Descarga sin autenticación denegada
      const unauthRes = await request(app)
        .get(`/solicitudes/${rentalId}/documentos/CONTRACT`)
        .set('Accept', 'application/json');
      expect(unauthRes.status).toBe(401);
    });
  });

  // =========================================================================
  // CAR-06: Pago y facturación (AC-06.1 a AC-06.3) + T6 submitToLegal
  // =========================================================================
  describe('CAR-06: Pago y facturación (T5 registerPayment + T6 submitToLegal)', () => {
    it('AC-06.1: auxiliar registra pago con comprobante, recibo, factura y soporte opcional', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const drafted = await createRentalInState(RentalStatus.CONTRACT_DRAFTED);
      const rentalId = drafted.rental.id;
      const quoted = drafted.rental.quotedAmountPesos!;

      const dummyPdf = Buffer.from('%PDF-1.4 comprobante de consignacion bancaria');

      const res = await agent
        .post(`/solicitudes/${rentalId}/transiciones/registerPayment`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .field('_csrf', csrfToken)
        .field('receiptNumber', 'REC-2026-0099')
        .field('bankName', 'Banco de Occidente')
        .field('voucherNumber', 'TX-77665544')
        .field('paidAt', '2026-10-15')
        .field('invoiceNumber', 'FAC-2026-1001')
        .field('invoiceDate', '2026-10-15')
        .field('amountPesos', quoted)
        .attach('voucherFile', dummyPdf, 'comprobante_banco.pdf');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PAID');
      expect(res.body.payment).toBeDefined();
      expect(res.body.payment.receiptNumber).toBe('REC-2026-0099');
      expect(res.body.payment.bankName).toBe('Banco de Occidente');
      expect(res.body.payment.voucherNumber).toBe('TX-77665544');
      expect(res.body.payment.invoiceNumber).toBe('FAC-2026-1001');
      expect(res.body.payment.amountPesos).toBe(quoted);
      expect(res.body.payment.voucherFileKey).toBeTruthy();

      // Verificar persistencia en base de datos
      const paymentDb = await prisma.payment.findUnique({
        where: { rentalRequestId: rentalId },
      });
      expect(paymentDb).not.toBeNull();
      expect(paymentDb!.receiptNumber).toBe('REC-2026-0099');
      expect(paymentDb!.voucherFileKey).toBe(res.body.payment.voucherFileKey);

      // Verificar que la solicitud pasó a PAID
      const updatedReq = await prisma.rentalRequest.findUnique({
        where: { id: rentalId },
      });
      expect(updatedReq!.status).toBe(RentalStatus.PAID);

      // Verificar registro de auditoría StateTransition
      const transition = await prisma.stateTransition.findFirst({
        where: { rentalRequestId: rentalId, transition: 'registerPayment' },
      });
      expect(transition).not.toBeNull();
      expect(transition!.fromStatus).toBe('CONTRACT_DRAFTED');
      expect(transition!.toStatus).toBe('PAID');
    });

    it('AC-06.2: si el monto pagado no coincide con el valor cotizado, se rechaza con error explicativo (regla A-08)', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const drafted = await createRentalInState(RentalStatus.CONTRACT_DRAFTED);
      const rentalId = drafted.rental.id;
      const quoted = drafted.rental.quotedAmountPesos!;

      const diffAmount = quoted + 50000;

      const res = await agent
        .post(`/solicitudes/${rentalId}/transiciones/registerPayment`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send({
          receiptNumber: 'REC-2026-DIFF',
          bankName: 'Bancolombia',
          voucherNumber: 'TX-DIFF-1122',
          paidAt: '2026-10-15',
          invoiceNumber: 'FAC-2026-DIFF',
          invoiceDate: '2026-10-15',
          amountPesos: diffAmount,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/coincidir exactamente con el valor cotizado/i);

      // Verificar que la solicitud permanece en CONTRACT_DRAFTED
      const reqDb = await prisma.rentalRequest.findUnique({
        where: { id: rentalId },
      });
      expect(reqDb!.status).toBe(RentalStatus.CONTRACT_DRAFTED);
    });

    it('AC-06.3: tras registrar el pago el estado es PAID, y luego T6 submitToLegal pasa a LEGAL_REVIEW', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const drafted = await createRentalInState(RentalStatus.CONTRACT_DRAFTED);
      const rentalId = drafted.rental.id;
      const quoted = drafted.rental.quotedAmountPesos!;

      // 1. Registrar pago exitoso (sin archivo adjunto)
      const resPay = await agent
        .post(`/solicitudes/${rentalId}/transiciones/registerPayment`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send({
          receiptNumber: 'REC-2026-0055',
          bankName: 'Davivienda',
          voucherNumber: 'VOUCH-554433',
          paidAt: '2026-10-16',
          invoiceNumber: 'FAC-2026-0550',
          invoiceDate: '2026-10-16',
          amountPesos: quoted,
        });

      expect(resPay.status).toBe(200);
      expect(resPay.body.status).toBe('PAID');

      // 2. Auxiliar ejecuta T6 submitToLegal
      const resLegal = await agent
        .post(`/solicitudes/${rentalId}/transiciones/submitToLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send({
          note: 'Expediente completo y soporte de consignación verificado para revisión jurídica',
        });

      expect(resLegal.status).toBe(200);
      expect(resLegal.body.status).toBe('LEGAL_REVIEW');

      // Verificar estado en BD
      const reqDb = await prisma.rentalRequest.findUnique({
        where: { id: rentalId },
      });
      expect(reqDb!.status).toBe(RentalStatus.LEGAL_REVIEW);

      // Verificar transición en BD
      const transition = await prisma.stateTransition.findFirst({
        where: { rentalRequestId: rentalId, transition: 'submitToLegal' },
      });
      expect(transition).not.toBeNull();
      expect(transition!.fromStatus).toBe('PAID');
      expect(transition!.toStatus).toBe('LEGAL_REVIEW');
    });

    it('impide registrar pago en estados distintos a CONTRACT_DRAFTED y someter a jurídica si no está en PAID', async () => {
      const { agent, csrfToken } = await loginAs(app, UserRole.ADMIN_ASSISTANT);

      // Intento de registrar pago en DOCUMENTS_VERIFIED (debe dar 409 InvalidTransitionError)
      const docVerified = await createRentalInState(RentalStatus.DOCUMENTS_VERIFIED);
      const resPayBlocked = await agent
        .post(`/solicitudes/${docVerified.rental.id}/transiciones/registerPayment`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send({
          receiptNumber: 'REC-INVALID',
          bankName: 'Banco',
          voucherNumber: 'TX-1',
          paidAt: '2026-10-15',
          invoiceNumber: 'FAC-1',
          invoiceDate: '2026-10-15',
          amountPesos: 100000,
        });

      expect(resPayBlocked.status).toBe(409);

      // Intento de submitToLegal desde REGISTERED
      const registered = await createRentalInState(RentalStatus.REGISTERED);
      const resSubmitBlocked = await agent
        .post(`/solicitudes/${registered.rental.id}/transiciones/submitToLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send({});

      expect(resSubmitBlocked.status).toBe(409);

      // RBAC: intento de registrar pago o enviar a jurídica con rol sin permiso (403)
      const { agent: legalAgent, csrfToken: legalCsrf } = await loginAs(app, UserRole.LEGAL);
      const drafted2 = await createRentalInState(RentalStatus.CONTRACT_DRAFTED);
      const resPayForbidden = await legalAgent
        .post(`/solicitudes/${drafted2.rental.id}/transiciones/registerPayment`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', legalCsrf)
        .send({
          receiptNumber: 'REC-UNAUTH',
          bankName: 'Banco',
          voucherNumber: 'TX-UNAUTH',
          invoiceNumber: 'FAC-UNAUTH',
          invoiceDate: '2026-10-15',
          amountPesos: drafted2.rental.quotedAmountPesos!,
        });
      assertForbidden(resPayForbidden);

      const paid2 = await createRentalInState(RentalStatus.PAID);
      const resSubmitForbidden = await legalAgent
        .post(`/solicitudes/${paid2.rental.id}/transiciones/submitToLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', legalCsrf)
        .send({});
      assertForbidden(resSubmitForbidden);
    });
  });

  // =========================================================================
  // CAR-07: Revisión jurídica (AC-07.1 a AC-07.4)
  // =========================================================================
  describe('CAR-07: Revisión jurídica (T7 approveLegal, T8 returnLegal, T9 resubmitToLegal)', () => {
    it('AC-07.1: solicitud enviada por auxiliar queda en LEGAL_REVIEW y usuario Jurídica la visualiza', async () => {
      const { agent: _legalAgent } = await loginAs(app, UserRole.LEGAL);
      const paid = await createRentalInState(RentalStatus.PAID);
      const rentalId = paid.rental.id;

      // Auxiliar la envía a jurídica
      const { agent: assistantAgent, csrfToken: assistantCsrf } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const resSubmit = await assistantAgent
        .post(`/solicitudes/${rentalId}/transiciones/submitToLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', assistantCsrf)
        .send({ note: 'Expediente remitido a Jurídica' });

      expect(resSubmit.status).toBe(200);
      expect(resSubmit.body.status).toBe('LEGAL_REVIEW');

      // Jurídica la consulta en la base de datos
      const reqDb = await prisma.rentalRequest.findUnique({
        where: { id: rentalId },
      });
      expect(reqDb!.status).toBe(RentalStatus.LEGAL_REVIEW);
    });

    it('AC-07.2: Jurídica aprueba solo si marca las 3 verificaciones; rechaza con 400 si falta alguna', async () => {
      const { agent: legalAgent, csrfToken: legalCsrf } = await loginAs(app, UserRole.LEGAL);
      const inReview = await createRentalInState(RentalStatus.LEGAL_REVIEW);
      const rentalId = inReview.rental.id;

      // 1. Intento incompleto: falta clausesOk
      const resIncomplete = await legalAgent
        .post(`/solicitudes/${rentalId}/transiciones/approveLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', legalCsrf)
        .send({
          documentsOk: true,
          customerDataOk: true,
          clausesOk: false,
          observations: 'Falta validar cláusulas',
        });

      expect(resIncomplete.status).toBe(400);
      expect(resIncomplete.body.error).toMatch(/tres verificaciones obligatorias/i);

      // 2. Aprobación completa con las 3 verificaciones
      const resApprove = await legalAgent
        .post(`/solicitudes/${rentalId}/transiciones/approveLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', legalCsrf)
        .send({
          documentsOk: true,
          customerDataOk: true,
          clausesOk: true,
          observations: 'Documentación en regla, representación validada y cláusulas normativas conformes.',
        });

      expect(resApprove.status).toBe(200);
      expect(resApprove.body.status).toBe('PENDING_SIGNATURE');
      expect(resApprove.body.legalReview).toBeDefined();
      expect(resApprove.body.legalReview.decision).toBe('APPROVED');
      expect(resApprove.body.legalReview.round).toBe(1);

      // Verificar en BD
      const reviewDb = await prisma.legalReview.findFirst({
        where: { rentalRequestId: rentalId },
      });
      expect(reviewDb).not.toBeNull();
      expect(reviewDb!.decision).toBe('APPROVED');
      expect(reviewDb!.documentsOk).toBe(true);
      expect(reviewDb!.customerDataOk).toBe(true);
      expect(reviewDb!.clausesOk).toBe(true);

      const reqDb = await prisma.rentalRequest.findUnique({
        where: { id: rentalId },
      });
      expect(reqDb!.status).toBe(RentalStatus.PENDING_SIGNATURE);
    });

    it('AC-07.3: Jurídica devuelve con observaciones (≥10 chars); Auxiliar subsana y reenvía (Rondas 1 y 2)', async () => {
      const { agent: legalAgent, csrfToken: legalCsrf } = await loginAs(app, UserRole.LEGAL);
      const inReview = await createRentalInState(RentalStatus.LEGAL_REVIEW);
      const rentalId = inReview.rental.id;

      // 1. Devolución con menos de 10 caracteres rechazada
      const resShort = await legalAgent
        .post(`/solicitudes/${rentalId}/transiciones/returnLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', legalCsrf)
        .send({ observations: 'Corregir' });

      expect(resShort.status).toBe(400);
      expect(resShort.body.error).toMatch(/10 caracteres/i);

      // 2. Devolución válida (Ronda 1)
      const resReturn = await legalAgent
        .post(`/solicitudes/${rentalId}/transiciones/returnLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', legalCsrf)
        .send({
          observations: 'Ajustar la cláusula de indemnidad por daños patrimoniales según normativa local.',
        });

      expect(resReturn.status).toBe(200);
      expect(resReturn.body.status).toBe('RETURNED_BY_LEGAL');
      expect(resReturn.body.legalReview.decision).toBe('RETURNED');
      expect(resReturn.body.legalReview.round).toBe(1);

      // 3. Auxiliar subsana y reenvía a Jurídica (T9 resubmitToLegal)
      const { agent: assistantAgent, csrfToken: assistantCsrf } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const resResubmit = await assistantAgent
        .post(`/solicitudes/${rentalId}/transiciones/resubmitToLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', assistantCsrf)
        .send({
          additionalClauses: 'El arrendatario responderá solidariamente por daños según la normativa distrital ajustada.',
          note: 'Se ajustó la cláusula de indemnidad conforme a los hallazgos de la Ronda 1.',
        });

      expect(resResubmit.status).toBe(200);
      expect(resResubmit.body.status).toBe('LEGAL_REVIEW');

      // 4. Jurídica evalúa Ronda 2 y aprueba
      const resApproveR2 = await legalAgent
        .post(`/solicitudes/${rentalId}/transiciones/approveLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', legalCsrf)
        .send({
          documentsOk: true,
          customerDataOk: true,
          clausesOk: true,
          observations: 'Cláusula corregida satisfactoriamente para la Ronda 2.',
        });

      expect(resApproveR2.status).toBe(200);
      expect(resApproveR2.body.status).toBe('PENDING_SIGNATURE');
      expect(resApproveR2.body.legalReview.round).toBe(2);

      // Verificar historial de ambas rondas en BD
      const reviews = await prisma.legalReview.findMany({
        where: { rentalRequestId: rentalId },
        orderBy: { round: 'asc' },
      });
      expect(reviews.length).toBe(2);
      expect(reviews[0].round).toBe(1);
      expect(reviews[0].decision).toBe('RETURNED');
      expect(reviews[1].round).toBe(2);
      expect(reviews[1].decision).toBe('APPROVED');
    });

    it('AC-07.4: solo el rol LEGAL puede aprobar o devolver; auxiliar o secretario reciben 403', async () => {
      const inReview = await createRentalInState(RentalStatus.LEGAL_REVIEW);
      const rentalId = inReview.rental.id;

      // 1. Auxiliar intentando aprobar
      const { agent: assistantAgent, csrfToken: assistantCsrf } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const resApproveByAssistant = await assistantAgent
        .post(`/solicitudes/${rentalId}/transiciones/approveLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', assistantCsrf)
        .send({
          documentsOk: true,
          customerDataOk: true,
          clausesOk: true,
        });

      assertForbidden(resApproveByAssistant);

      // 2. Secretario intentando devolver
      const { agent: secretaryAgent, csrfToken: secCsrf } = await loginAs(app, UserRole.SECRETARY);
      const resReturnBySecretary = await secretaryAgent
        .post(`/solicitudes/${rentalId}/transiciones/returnLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', secCsrf)
        .send({
          observations: 'Observación no autorizada desde el despacho del Secretario',
        });

      assertForbidden(resReturnBySecretary);
    });
  });

  // =========================================================================
  // CAR-08: Firma y numeración atómica (T10) y Cancelación (T11)
  // =========================================================================
  describe('CAR-08: Firma, numeración atómica y cancelación (T10 signAndNumber, T11 cancel)', () => {
    it('AC-08.1: Secretario firma y numera contrato en PENDING_SIGNATURE; genera ARR-AAAA-NNNN y snapshot final', async () => {
      const { agent: secAgent, csrfToken: secCsrf } = await loginAs(app, UserRole.SECRETARY);
      const pending = await createRentalInState(RentalStatus.PENDING_SIGNATURE);
      const rentalId = pending.rental.id;

      const resSign = await secAgent
        .post(`/solicitudes/${rentalId}/transiciones/signAndNumber`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', secCsrf)
        .send({ notes: 'Firma protocolaria en despacho' });

      expect(resSign.status).toBe(200);
      expect(resSign.body.status).toBe('LEGALIZED');
      expect(resSign.body.contractNumber).toMatch(/^ARR-\d{4}-\d{4}$/);

      // Verificación en base de datos
      const reqDb = await prisma.rentalRequest.findUnique({
        where: { id: rentalId },
        include: {
          contract: true,
          reservations: true,
          generatedDocuments: true,
          stateTransitions: true,
        },
      });

      expect(reqDb!.status).toBe(RentalStatus.LEGALIZED);
      expect(reqDb!.contract!.number).toBe(resSign.body.contractNumber);
      expect(reqDb!.contract!.signedAt).toBeDefined();
      expect(reqDb!.contract!.signedById).toBeDefined();
      expect(reqDb!.reservations[0].status).toBe(ReservationStatus.CONFIRMED);

      // Snapshot final del contrato generado
      const finalContractDoc = reqDb!.generatedDocuments.find(
        (d) => d.kind === 'CONTRACT' && d.html.includes(resSign.body.contractNumber),
      );
      expect(finalContractDoc).toBeDefined();

      // Transición registrada
      const lastTransition = reqDb!.stateTransitions[reqDb!.stateTransitions.length - 1];
      expect(lastTransition.transition).toBe('signAndNumber');
      expect(lastTransition.toStatus).toBe('LEGALIZED');
    });

    it('AC-08.2: solicitud queda LEGALIZED, reserva CONFIRMED y no permite transiciones adicionales (inmutable)', async () => {
      const { agent: secAgent, csrfToken: secCsrf } = await loginAs(app, UserRole.SECRETARY);
      const legalized = await createRentalInState(RentalStatus.LEGALIZED);
      const rentalId = legalized.rental.id;

      // 1. Intento de volver a firmar
      const resDoubleSign = await secAgent
        .post(`/solicitudes/${rentalId}/transiciones/signAndNumber`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', secCsrf)
        .send({});

      expect(resDoubleSign.status).toBe(409);

      // 2. Intento de cancelar solicitud ya legalizada por parte del Auxiliar
      const { agent: assistantAgent, csrfToken: assistantCsrf } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const resCancelLegalized = await assistantAgent
        .post(`/solicitudes/${rentalId}/transiciones/cancel`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', assistantCsrf)
        .send({ reason: 'Intento de cancelar contrato ya legalizado' });

      expect(resCancelLegalized.status).toBe(409);
    });

    it('AC-08.3: firmas concurrentes nunca generan el mismo número de contrato consecutivo', async () => {
      const { agent: secAgent, csrfToken: secCsrf } = await loginAs(app, UserRole.SECRETARY);

      // Crear 3 solicitudes independientes listas para firmar
      const p1 = await createRentalInState(RentalStatus.PENDING_SIGNATURE);
      const p2 = await createRentalInState(RentalStatus.PENDING_SIGNATURE);
      const p3 = await createRentalInState(RentalStatus.PENDING_SIGNATURE);

      // Ejecutar 3 firmas en paralelo
      const [res1, res2, res3] = await Promise.all([
        secAgent
          .post(`/solicitudes/${p1.rental.id}/transiciones/signAndNumber`)
          .set('Accept', 'application/json')
          .set('X-CSRF-Token', secCsrf)
          .send({}),
        secAgent
          .post(`/solicitudes/${p2.rental.id}/transiciones/signAndNumber`)
          .set('Accept', 'application/json')
          .set('X-CSRF-Token', secCsrf)
          .send({}),
        secAgent
          .post(`/solicitudes/${p3.rental.id}/transiciones/signAndNumber`)
          .set('Accept', 'application/json')
          .set('X-CSRF-Token', secCsrf)
          .send({}),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);

      const num1 = res1.body.contractNumber;
      const num2 = res2.body.contractNumber;
      const num3 = res3.body.contractNumber;

      // Todos los números deben ser únicos
      const setNumbers = new Set([num1, num2, num3]);
      expect(setNumbers.size).toBe(3);

      // Extraer números enteros consecutivos
      const getConsecutive = (numStr: string) => parseInt(numStr.split('-')[2], 10);
      const sortedVals = [getConsecutive(num1), getConsecutive(num2), getConsecutive(num3)].sort((a, b) => a - b);
      expect(sortedVals[1]).toBe(sortedVals[0] + 1);
      expect(sortedVals[2]).toBe(sortedVals[1] + 1);
    });

    it('AC-08.4: cancelación desde estado activo libera reserva y exige motivo >= 10 caracteres', async () => {
      const { agent: assistantAgent, csrfToken: assistantCsrf } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const registered = await createRentalInState(RentalStatus.REGISTERED);
      const rentalId = registered.rental.id;

      // 1. Motivo muy corto (< 10 caracteres) -> 400
      const resShort = await assistantAgent
        .post(`/solicitudes/${rentalId}/transiciones/cancel`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', assistantCsrf)
        .send({ reason: 'Muy corto' });

      expect(resShort.status).toBe(400);

      // 2. Cancelación válida por Auxiliar
      const resCancel = await assistantAgent
        .post(`/solicitudes/${rentalId}/transiciones/cancel`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', assistantCsrf)
        .send({ reason: 'El solicitante desiste por motivos de fuerza mayor' });

      expect(resCancel.status).toBe(200);
      expect(resCancel.body.status).toBe('CANCELLED');

      const reqDb = await prisma.rentalRequest.findUnique({
        where: { id: rentalId },
        include: { reservations: true, stateTransitions: true },
      });

      expect(reqDb!.status).toBe(RentalStatus.CANCELLED);
      expect(reqDb!.cancelReason).toBe('El solicitante desiste por motivos de fuerza mayor');
      expect(reqDb!.reservations[0].status).toBe(ReservationStatus.RELEASED);

      // 3. Cancelación después de pago anota advertencia A-11 en la transición
      const paid = await createRentalInState(RentalStatus.PAID);
      const resCancelPaid = await assistantAgent
        .post(`/solicitudes/${paid.rental.id}/transiciones/cancel`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', assistantCsrf)
        .send({ reason: 'Cancelación solicitada con pago ya registrado' });

      expect(resCancelPaid.status).toBe(200);
      const paidReqDb = await prisma.rentalRequest.findUnique({
        where: { id: paid.rental.id },
        include: { stateTransitions: true },
      });
      const lastTransition = paidReqDb!.stateTransitions[paidReqDb!.stateTransitions.length - 1];
      expect(lastTransition.note).toContain('A-11');
      expect(lastTransition.note).toContain('devolución');
    });

    it('AC-08.5: Jefe de Oficina puede cancelar; Jurídica o Secretario reciben 403', async () => {
      // 1. Jefe de Oficina cancela exitosamente
      const { agent: headAgent, csrfToken: headCsrf } = await loginAs(app, UserRole.OFFICE_HEAD);
      const reqHead = await createRentalInState(RentalStatus.RESPONDED);
      const resHeadCancel = await headAgent
        .post(`/solicitudes/${reqHead.rental.id}/transiciones/cancel`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', headCsrf)
        .send({ reason: 'Cancelación administrativa por cruce institucional' });

      expect(resHeadCancel.status).toBe(200);

      // 2. Jurídica intenta cancelar -> 403
      const { agent: legalAgent, csrfToken: legalCsrf } = await loginAs(app, UserRole.LEGAL);
      const reqLegal = await createRentalInState(RentalStatus.LEGAL_REVIEW);
      const resLegalCancel = await legalAgent
        .post(`/solicitudes/${reqLegal.rental.id}/transiciones/cancel`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', legalCsrf)
        .send({ reason: 'Jurídica no puede cancelar solicitudes directamente' });

      assertForbidden(resLegalCancel);
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
  // CAR-09: Consulta de estado, listado y detalle con línea de tiempo (AC-09.1 a AC-09.3)
  // =========================================================================
  describe('CAR-09: Consulta de estado, listado y detalle con línea de tiempo', () => {
    it('AC-09.1: listado paginado y con filtros por estado, búsqueda de texto libre y espacio', async () => {
      const { agent } = await loginAs(app, UserRole.ADMIN_ASSISTANT);

      // Crear 3 solicitudes con estados y datos distintivos
      const r1 = await createRentalInState(RentalStatus.REGISTERED);
      await prisma.rentalRequest.update({
        where: { id: r1.rental.id },
        data: { eventName: 'Festival de Cine Colombiano' },
      });

      const r2 = await createRentalInState(RentalStatus.RESPONDED);
      await prisma.rentalRequest.update({
        where: { id: r2.rental.id },
        data: { eventName: 'Concierto Sinfónico Juvenil' },
      });
      await prisma.customer.update({
        where: { id: r2.rental.customerId },
        data: { name: 'Carlos Mario Restrepo', documentNumber: '99887766' },
      });

      const r3 = await createRentalInState(RentalStatus.LEGALIZED);
      await prisma.rentalRequest.update({
        where: { id: r3.rental.id },
        data: { eventName: 'Conferencia Magistral TIC' },
      });

      // 1. Listado completo
      const resAll = await agent
        .get('/solicitudes')
        .set('Accept', 'application/json');
      expect(resAll.status).toBe(200);
      expect(resAll.body.items).toHaveLength(3);
      expect(resAll.body.pagination.totalItems).toBe(3);

      // 2. Filtro por estado RESPONDED
      const resResponded = await agent
        .get('/solicitudes?status=RESPONDED')
        .set('Accept', 'application/json');
      expect(resResponded.status).toBe(200);
      expect(resResponded.body.items).toHaveLength(1);
      expect(resResponded.body.items[0].id).toBe(r2.rental.id);

      // 3. Búsqueda por nombre de cliente (Carlos)
      const resSearchCustomer = await agent
        .get('/solicitudes?q=Carlos')
        .set('Accept', 'application/json');
      expect(resSearchCustomer.status).toBe(200);
      expect(resSearchCustomer.body.items).toHaveLength(1);
      expect(resSearchCustomer.body.items[0].id).toBe(r2.rental.id);

      // 4. Búsqueda por evento (Festival)
      const resSearchEvent = await agent
        .get('/solicitudes?q=Festival')
        .set('Accept', 'application/json');
      expect(resSearchEvent.status).toBe(200);
      expect(resSearchEvent.body.items).toHaveLength(1);
      expect(resSearchEvent.body.items[0].id).toBe(r1.rental.id);

      // 5. Búsqueda por número de contrato oficial
      const contractNum = r3.contract!.number;
      const resSearchContract = await agent
        .get(`/solicitudes?q=${contractNum}`)
        .set('Accept', 'application/json');
      expect(resSearchContract.status).toBe(200);
      expect(resSearchContract.body.items).toHaveLength(1);
      expect(resSearchContract.body.items[0].id).toBe(r3.rental.id);

      // 6. Paginación (pageSize = 2)
      const resPage1 = await agent
        .get('/solicitudes?page=1&pageSize=2')
        .set('Accept', 'application/json');
      expect(resPage1.status).toBe(200);
      expect(resPage1.body.items).toHaveLength(2);
      expect(resPage1.body.pagination.page).toBe(1);
      expect(resPage1.body.pagination.pageSize).toBe(2);
      expect(resPage1.body.pagination.totalItems).toBe(3);
      expect(resPage1.body.pagination.totalPages).toBe(2);
      expect(resPage1.body.pagination.hasNext).toBe(true);

      const resPage2 = await agent
        .get('/solicitudes?page=2&pageSize=2')
        .set('Accept', 'application/json');
      expect(resPage2.status).toBe(200);
      expect(resPage2.body.items).toHaveLength(1);
      expect(resPage2.body.pagination.hasNext).toBe(false);

      // 7. Render HTML del listado
      const resHtml = await agent
        .get('/solicitudes')
        .set('Accept', 'text/html');
      expect(resHtml.status).toBe(200);
      expect(resHtml.text).toContain('Solicitudes de Alquiler de Escenarios');
      expect(resHtml.text).toContain('Festival de Cine Colombiano');

      // 8. Render HTML del formulario de nueva solicitud
      const resNewForm = await agent
        .get('/solicitudes/nueva')
        .set('Accept', 'text/html');
      expect(resNewForm.status).toBe(200);
      expect(resNewForm.text).toContain('Registrar Nueva Solicitud de Alquiler');
    });

    it('AC-09.2: detalle de solicitud con línea de tiempo completa, documentos, pago y revisiones', async () => {
      const { agent } = await loginAs(app, UserRole.ADMIN_ASSISTANT);

      // Crear solicitud en estado PAID para verificar relaciones ricas
      const { rental } = await createRentalInState(RentalStatus.PAID);

      const res = await agent
        .get(`/solicitudes/${rental.id}`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      const data = res.body.rental;
      expect(data.id).toBe(rental.id);
      expect(data.status).toBe(RentalStatus.PAID);
      expect(data.customer).toBeDefined();
      expect(data.space).toBeDefined();
      expect(data.space.venue).toBeDefined();
      expect(data.contract).toBeDefined();
      expect(data.payment).toBeDefined();
      expect(data.payment.invoiceNumber).toBeDefined();
      expect(data.requestDocuments.length).toBeGreaterThan(0);
      expect(data.stateTransitions.length).toBeGreaterThan(0);

      // Verificar que cada transición tiene actor y marca temporal
      for (const t of data.stateTransitions) {
        expect(t.transition).toBeDefined();
        expect(t.actor).toBeDefined();
        expect(t.actor.name).toBeDefined();
        expect(t.occurredAt).toBeDefined();
      }

      // Render HTML del detalle
      const resHtml = await agent
        .get(`/solicitudes/${rental.id}`)
        .set('Accept', 'text/html');
      expect(resHtml.status).toBe(200);
      expect(resHtml.text).toContain('Flujo del trámite');
      expect(resHtml.text).toContain(rental.eventName);

      // Solicitud inexistente retorna 404
      const resNotFound = await agent
        .get('/solicitudes/00000000-0000-0000-0000-000000000000')
        .set('Accept', 'application/json');
      expect(resNotFound.status).toBe(404);
    });

    it('AC-09.3: allowedTransitions muestra estrictamente las acciones que el rol actual puede ejecutar', async () => {
      // 1. Solicitud en REGISTERED
      const sReg = await createRentalInState(RentalStatus.REGISTERED);

      // Auxiliar en REGISTERED -> puede responder y cancelar
      const { agent: auxAgent } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const resAuxReg = await auxAgent
        .get(`/solicitudes/${sReg.rental.id}`)
        .set('Accept', 'application/json');
      expect(resAuxReg.status).toBe(200);
      expect(resAuxReg.body.allowedTransitions).toContain('respond');
      expect(resAuxReg.body.allowedTransitions).toContain('cancel');

      // Jefe en REGISTERED -> solo cancelar
      const { agent: headAgent } = await loginAs(app, UserRole.OFFICE_HEAD);
      const resHeadReg = await headAgent
        .get(`/solicitudes/${sReg.rental.id}`)
        .set('Accept', 'application/json');
      expect(resHeadReg.status).toBe(200);
      expect(resHeadReg.body.allowedTransitions).toEqual(['cancel']);

      // Jurídica en REGISTERED -> ninguna acción permitida
      const { agent: legalAgent } = await loginAs(app, UserRole.LEGAL);
      const resLegalReg = await legalAgent
        .get(`/solicitudes/${sReg.rental.id}`)
        .set('Accept', 'application/json');
      expect(resLegalReg.status).toBe(200);
      expect(resLegalReg.body.allowedTransitions).toEqual([]);

      // 2. Solicitud en LEGAL_REVIEW
      const sLegal = await createRentalInState(RentalStatus.LEGAL_REVIEW);

      // Jurídica en LEGAL_REVIEW -> approveLegal y returnLegal
      const resLegalReview = await legalAgent
        .get(`/solicitudes/${sLegal.rental.id}`)
        .set('Accept', 'application/json');
      expect(resLegalReview.status).toBe(200);
      expect(resLegalReview.body.allowedTransitions).toContain('approveLegal');
      expect(resLegalReview.body.allowedTransitions).toContain('returnLegal');
      expect(resLegalReview.body.allowedTransitions).not.toContain('cancel');

      // Auxiliar en LEGAL_REVIEW -> solo cancelar
      const resAuxLegal = await auxAgent
        .get(`/solicitudes/${sLegal.rental.id}`)
        .set('Accept', 'application/json');
      expect(resAuxLegal.status).toBe(200);
      expect(resAuxLegal.body.allowedTransitions).toEqual(['cancel']);

      // 3. Solicitud en PENDING_SIGNATURE
      const sPending = await createRentalInState(RentalStatus.PENDING_SIGNATURE);

      // Secretario en PENDING_SIGNATURE -> signAndNumber
      const { agent: secAgent } = await loginAs(app, UserRole.SECRETARY);
      const resSecPending = await secAgent
        .get(`/solicitudes/${sPending.rental.id}`)
        .set('Accept', 'application/json');
      expect(resSecPending.status).toBe(200);
      expect(resSecPending.body.allowedTransitions).toEqual(['signAndNumber']);

      // Jurídica en PENDING_SIGNATURE -> ninguna acción
      const resLegalPending = await legalAgent
        .get(`/solicitudes/${sPending.rental.id}`)
        .set('Accept', 'application/json');
      expect(resLegalPending.status).toBe(200);
      expect(resLegalPending.body.allowedTransitions).toEqual([]);
    });
  });

  // =========================================================================
  // CAR-19: Roles, Autorización y Seguridad (AC-19.1 a AC-19.3)
  // =========================================================================
  describe('CAR-19: Roles y Seguridad en el Servidor', () => {
    it('AC-19.2: usuario sin permiso recibe 403 Forbidden al invocar rutas protegidas (todas las rutas del sistema)', async () => {
      const reg = await createRentalInState(RentalStatus.REGISTERED);
      const paid = await createRentalInState(RentalStatus.PAID);
      const legalRev = await createRentalInState(RentalStatus.LEGAL_REVIEW);
      const pendingSig = await createRentalInState(RentalStatus.PENDING_SIGNATURE);

      // 1. POST /solicitudes (rentals:register) - LEGAL -> 403
      const { agent: legalAgent, csrfToken: legalCsrf } = await loginAs(app, UserRole.LEGAL);
      const resRegister = await legalAgent
        .post('/solicitudes')
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', legalCsrf)
        .send(buildValidRegistrationPayload());
      assertForbidden(resRegister);

      // 2. GET /solicitudes/nueva (rentals:register) - SECRETARY -> 403
      const { agent: secAgent, csrfToken: secCsrf } = await loginAs(app, UserRole.SECRETARY);
      const resNewForm = await secAgent
        .get('/solicitudes/nueva')
        .set('Accept', 'application/json');
      assertForbidden(resNewForm);

      // 3. POST /solicitudes/:id/transiciones/respond (rentals:respond) - SECRETARY -> 403
      const resRespond = await secAgent
        .post(`/solicitudes/${reg.rental.id}/transiciones/respond`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', secCsrf)
        .send({ responseRadicado: 'RAD-SECRETARY-UNAUTHORIZED' });
      assertForbidden(resRespond);

      // 4. POST /solicitudes/:id/documentos/:code/verificar (rentals:verify-docs) - LEGAL -> 403
      const resVerifyDoc = await legalAgent
        .post(`/solicitudes/${reg.rental.id}/documentos/DOC_CEDULA/verificar`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', legalCsrf)
        .send({ approved: true });
      assertForbidden(resVerifyDoc);

      // 5. POST /solicitudes/:id/transiciones/draftContract (rentals:draft-contract) - SECRETARY -> 403
      const resDraft = await secAgent
        .post(`/solicitudes/${reg.rental.id}/transiciones/draftContract`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', secCsrf)
        .send({ object: 'Nuevo objeto' });
      assertForbidden(resDraft);

      // 6. POST /solicitudes/:id/transiciones/registerPayment (rentals:register-payment) - LEGAL -> 403
      const resPayment = await legalAgent
        .post(`/solicitudes/${reg.rental.id}/transiciones/registerPayment`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', legalCsrf)
        .send({
          receiptNumber: 'RC-1',
          bankName: 'Bancolombia',
          voucherNumber: 'V-1',
          amountPesos: 100000,
          invoiceNumber: 'FAC-1',
          invoiceDate: '2026-11-01',
        });
      assertForbidden(resPayment);

      // 7. POST /solicitudes/:id/transiciones/submitToLegal (rentals:submit-legal) - SECRETARY -> 403
      const resSubmitLegal = await secAgent
        .post(`/solicitudes/${paid.rental.id}/transiciones/submitToLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', secCsrf)
        .send({});
      assertForbidden(resSubmitLegal);

      // 8. POST /solicitudes/:id/transiciones/approveLegal (rentals:approve-legal) - ADMIN_ASSISTANT -> 403
      const { agent: auxAgent, csrfToken: auxCsrf } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const resApprove = await auxAgent
        .post(`/solicitudes/${legalRev.rental.id}/transiciones/approveLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', auxCsrf)
        .send({ documentsOk: true, customerDataOk: true, clausesOk: true });
      assertForbidden(resApprove);

      // 9. POST /solicitudes/:id/transiciones/returnLegal (rentals:return-legal) - ADMIN_ASSISTANT -> 403
      const resReturn = await auxAgent
        .post(`/solicitudes/${legalRev.rental.id}/transiciones/returnLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', auxCsrf)
        .send({ observations: 'Observaciones con mas de diez caracteres' });
      assertForbidden(resReturn);

      // 10. POST /solicitudes/:id/transiciones/resubmitToLegal (rentals:resubmit-legal) - LEGAL -> 403
      const resResubmit = await legalAgent
        .post(`/solicitudes/${legalRev.rental.id}/transiciones/resubmitToLegal`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', legalCsrf)
        .send({ note: 'Ajustes realizados' });
      assertForbidden(resResubmit);

      // 11. POST /solicitudes/:id/transiciones/signAndNumber (rentals:sign-number) - ADMIN_ASSISTANT -> 403
      const resSign = await auxAgent
        .post(`/solicitudes/${pendingSig.rental.id}/transiciones/signAndNumber`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', auxCsrf)
        .send({});
      assertForbidden(resSign);

      // 12. POST /solicitudes/:id/transiciones/cancel (rentals:cancel) - LEGAL -> 403
      const resCancel = await legalAgent
        .post(`/solicitudes/${reg.rental.id}/transiciones/cancel`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', legalCsrf)
        .send({ reason: 'Motivo de cancelacion de mas de diez caracteres' });
      assertForbidden(resCancel);

      // 13. GET /agenda (agenda:read) - MAINTENANCE_TECH -> 403
      const { agent: maintAgent } = await loginAs(app, UserRole.MAINTENANCE_TECH);
      const resAgenda = await maintAgent
        .get('/agenda')
        .set('Accept', 'application/json');
      assertForbidden(resAgenda);

      // 14. GET /agenda/disponibilidad (agenda:read) - MAINTENANCE_TECH -> 403
      const resDisp = await maintAgent
        .get('/agenda/disponibilidad?spaceId=space-auditorio-principal&startsAt=2026-11-01T10:00:00Z&endsAt=2026-11-01T14:00:00Z')
        .set('Accept', 'application/json');
      assertForbidden(resDisp);

      // 15. GET /tarifas (tariffs:read) - OPERATIONS_TECH -> 403
      const { agent: opsAgent } = await loginAs(app, UserRole.OPERATIONS_TECH);
      const resTarifas = await opsAgent
        .get('/tarifas')
        .set('Accept', 'application/json');
      assertForbidden(resTarifas);

      // 16. POST /tarifas/:id (tariffs:update) - ADMIN_ASSISTANT -> 403
      const tariff = await prisma.tariff.findFirst();
      const resUpdateTariff = await auxAgent
        .post(`/tarifas/${tariff!.id}`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', auxCsrf)
        .send({ amountPesos: 999999 });
      assertForbidden(resUpdateTariff);

      // 17. GET /solicitudes (rentals:read) - OPERATIONS_TECH -> 403
      const resListRentals = await opsAgent
        .get('/solicitudes')
        .set('Accept', 'application/json');
      assertForbidden(resListRentals);

      // 18. GET /solicitudes/:id (rentals:read) - MAINTENANCE_TECH -> 403
      const resDetailRental = await maintAgent
        .get(`/solicitudes/${reg.rental.id}`)
        .set('Accept', 'application/json');
      assertForbidden(resDetailRental);

      // 19. GET /solicitudes/:id/documentos/oficio (rentals:read) - OPERATIONS_TECH -> 403
      const resDoc = await opsAgent
        .get(`/solicitudes/${reg.rental.id}/documentos/oficio`)
        .set('Accept', 'application/json');
      assertForbidden(resDoc);

      // 20. GET /archivos/:key (files:download) - OPERATIONS_TECH -> 403
      const resFile = await opsAgent
        .get('/archivos/nonexistent-key')
        .set('Accept', 'application/json');
      assertForbidden(resFile);
    });

    it('AC-19.1 & AC-19.2: usuarios autorizados acceden exitosamente a agenda, tarifas y home', async () => {
      // 1. Jefe de Oficina actualiza tarifa con éxito
      const { agent: headAgent, csrfToken: headCsrf } = await loginAs(app, UserRole.OFFICE_HEAD);
      const tariff = await prisma.tariff.findFirst();
      const resUpdateTariff = await headAgent
        .post(`/tarifas/${tariff!.id}`)
        .set('Accept', 'application/json')
        .set('X-CSRF-Token', headCsrf)
        .send({ amountPesos: 750000 });
      expect(resUpdateTariff.status).toBe(200);
      expect(resUpdateTariff.body.tariff.pricePesos).toBe(750000);

      // 2. Auxiliar consulta agenda y disponibilidad con éxito
      const { agent: auxAgent } = await loginAs(app, UserRole.ADMIN_ASSISTANT);
      const resAgenda = await auxAgent
        .get('/agenda')
        .set('Accept', 'application/json');
      expect(resAgenda.status).toBe(200);
      expect(resAgenda.body.reservations).toBeDefined();

      const resDisp = await auxAgent
        .get('/agenda/disponibilidad?spaceId=space-auditorio-principal&startsAt=2026-11-25T10:00:00Z&endsAt=2026-11-25T14:00:00Z')
        .set('Accept', 'application/json');
      expect(resDisp.status).toBe(200);
      expect(resDisp.body.available).toBe(true);

      // 3. Auxiliar consulta tarifas en modo lectura
      const resTarifas = await auxAgent
        .get('/tarifas')
        .set('Accept', 'application/json');
      expect(resTarifas.status).toBe(200);
      expect(resTarifas.body.tariffs.length).toBeGreaterThan(0);

      // 4. Home dashboard carga correctamente para usuario con sesión
      const resHome = await auxAgent
        .get('/')
        .set('Accept', 'text/html');
      expect(resHome.status).toBe(200);
      expect(resHome.text).toContain('Bienvenido');
      expect(resHome.text).toContain('Auxiliar Administrativo');
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
