import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  CustomerType,
  DocumentKind,
  EventPurpose,
  PricingUnit,
  RentalStatus,
  RequestChannel,
} from '@prisma/client';
import { prisma } from '../../src/infra/prisma.js';
import { cleanDatabase, disconnectDatabase } from '../helpers/db.js';
import {
  createUser,
  createVenue,
  createSpace,
  createCustomer,
  createTariff,
} from '../helpers/factories.js';
import { DocumentRenderer } from '../../src/modules/documents/documentRenderer.js';
import { normalizeDocumentKind } from '../../src/modules/documents/routes.js';

describe('DocumentRenderer Service & Templates', () => {
  let renderer: DocumentRenderer;

  beforeEach(async () => {
    await cleanDatabase();
    renderer = new DocumentRenderer(prisma);
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('normalizeDocumentKind', () => {
    it('normalizes uppercase, lowercase and aliases', () => {
      expect(normalizeDocumentKind('RESPONSE_LETTER')).toBe(DocumentKind.RESPONSE_LETTER);
      expect(normalizeDocumentKind('response_letter')).toBe(DocumentKind.RESPONSE_LETTER);
      expect(normalizeDocumentKind('response-letter')).toBe(DocumentKind.RESPONSE_LETTER);
      expect(normalizeDocumentKind('oficio')).toBe(DocumentKind.RESPONSE_LETTER);
      expect(normalizeDocumentKind('oficio-respuesta')).toBe(DocumentKind.RESPONSE_LETTER);

      expect(normalizeDocumentKind('PRIOR_STUDY')).toBe(DocumentKind.PRIOR_STUDY);
      expect(normalizeDocumentKind('prior-study')).toBe(DocumentKind.PRIOR_STUDY);
      expect(normalizeDocumentKind('estudio-previo')).toBe(DocumentKind.PRIOR_STUDY);

      expect(normalizeDocumentKind('CONTRACT')).toBe(DocumentKind.CONTRACT);
      expect(normalizeDocumentKind('contract')).toBe(DocumentKind.CONTRACT);
      expect(normalizeDocumentKind('contrato')).toBe(DocumentKind.CONTRACT);

      expect(normalizeDocumentKind('invalid_kind')).toBeNull();
    });
  });

  describe('generateResponseLetter', () => {
    it('generates version 1 RESPONSE_LETTER with all required fields (A-13, SPEC §11)', async () => {
      const user = await createUser();
      const venue = await createVenue({ name: 'Centro Cultural Lucy Tejada' });
      const space = await createSpace(venue.id, {
        name: 'Auditorio Principal',
        capacity: 200,
        pricingUnit: PricingUnit.HOUR,
      });
      const tariff = await createTariff(space.id, {
        pricePesos: 450000,
        unit: PricingUnit.HOUR,
        purpose: EventPurpose.LUCRATIVE,
      });

      const customer = await createCustomer({
        type: CustomerType.NATURAL,
        name: 'Carlos Ramírez Gómez',
        documentType: 'CC',
        documentNumber: '1098765432',
      });

      // Seed requirement (upsert in case already seeded by cleanDatabase)
      await prisma.documentRequirement.upsert({
        where: {
          customerType_code: {
            customerType: CustomerType.NATURAL,
            code: 'CC',
          },
        },
        update: {
          name: 'Documento de identidad al 150%',
        },
        create: {
          customerType: CustomerType.NATURAL,
          code: 'CC',
          name: 'Documento de identidad al 150%',
          mandatory: true,
        },
      });

      const startsAt = new Date('2026-10-15T13:00:00Z'); // 08:00 COT
      const endsAt = new Date('2026-10-15T19:00:00Z'); // 14:00 COT (6 hours)

      const rental = await prisma.rentalRequest.create({
        data: {
          customerId: customer.id,
          spaceId: space.id,
          eventName: 'Festival Internacional de Poesía',
          eventDescription: 'Recital poético con autores de la región',
          purpose: EventPurpose.LUCRATIVE,
          expectedAttendees: 150,
          startsAt,
          endsAt,
          channel: RequestChannel.WRITTEN,
          status: RentalStatus.RESPONDED,
          responseRadicado: 'RAD-RESP-2026-0042',
          quotedTariffId: tariff.id,
          quotedAmountPesos: 2700000,
          createdById: user.id,
        },
      });

      await renderer.generateResponseLetter(rental.id, user.id);

      const docs = await prisma.generatedDocument.findMany({
        where: { rentalRequestId: rental.id },
      });

      expect(docs).toHaveLength(1);
      const doc = docs[0];
      expect(doc.kind).toBe(DocumentKind.RESPONSE_LETTER);
      expect(doc.version).toBe(1);
      expect(doc.generatedById).toBe(user.id);

      // Verify HTML contents
      const html = doc.html;
      // Institutional header without logos
      expect(html).toContain('SECRETARÍA DE CULTURA DE PEREIRA');
      expect(html).toContain('Oficina de Administración de Escenarios y Bienes Culturales');
      // Radicado & date
      expect(html).toContain('RAD-RESP-2026-0042');
      expect(html).toContain('Pereira, ');
      // Destinatario
      expect(html).toContain('Carlos Ramírez Gómez');
      expect(html).toContain('1098765432');
      // Asunto & body
      expect(html).toContain('Respuesta a solicitud de alquiler — Festival Internacional de Poesía');
      expect(html).toContain('Centro Cultural Lucy Tejada');
      expect(html).toContain('Auditorio Principal');
      expect(html).toContain('Festival Internacional de Poesía');
      // Requirement
      expect(html).toContain('Documento de identidad al 150%');
      expect(html).toContain('Obligatorio');
      // Amounts
      expect(html).toContain('$ 2.700.000');
      expect(html).toContain('Dos millones setecientos mil pesos M/CTE');
      // Fictitious bank details
      expect(html).toContain('Bancolombia');
      expect(html).toContain('1234-567890-89');
      expect(html).toContain('800.123.456-7');
      // Typographic signature
      expect(html).toContain('Jefe de la Oficina de Administración de Escenarios y Bienes Culturales');
      // A-13 academic disclaimer
      expect(html).toContain('Formato generado por SGEC — proyecto académico');
    });
  });

  describe('generatePriorStudyAndContract', () => {
    it('generates PRIOR_STUDY and CONTRACT with incremental version and legal norms (A-13, SPEC §11)', async () => {
      const user = await createUser();
      const venue = await createVenue({ name: 'Teatro Municipal Santiago Londoño' });
      const space = await createSpace(venue.id, {
        name: 'Sala Principal',
        capacity: 800,
        pricingUnit: PricingUnit.DAY,
      });
      const tariff = await createTariff(space.id, {
        pricePesos: 3200000,
        unit: PricingUnit.DAY,
        purpose: EventPurpose.LUCRATIVE,
      });

      const customer = await createCustomer({
        type: CustomerType.LEGAL,
        name: 'Fundación Arte y Vida',
        documentType: 'NIT',
        documentNumber: '900987654-1',
        legalRepresentative: 'Marta Lucía Henao',
      });

      const startsAt = new Date('2026-10-20T13:00:00Z');
      const endsAt = new Date('2026-10-21T13:00:00Z'); // 1 day

      const rental = await prisma.rentalRequest.create({
        data: {
          customerId: customer.id,
          spaceId: space.id,
          eventName: 'Obra de Teatro Comunitaria',
          eventDescription: 'Montaje de dramaturgia local',
          purpose: EventPurpose.LUCRATIVE,
          expectedAttendees: 500,
          startsAt,
          endsAt,
          channel: RequestChannel.EMAIL,
          status: RentalStatus.DOCUMENTS_VERIFIED,
          quotedTariffId: tariff.id,
          quotedAmountPesos: 3200000,
          createdById: user.id,
        },
      });

      await prisma.contract.create({
        data: {
          rentalRequestId: rental.id,
          object: 'Arrendamiento de la Sala Principal para la Obra de Teatro Comunitaria',
          valuePesos: 3200000,
          additionalClauses: 'El arrendatario proveerá su propio equipo de microfonía inalámbrica.',
        },
      });

      // First generation (v1)
      await renderer.generatePriorStudyAndContract(rental.id, 1, user.id);

      const docsV1 = await prisma.generatedDocument.findMany({
        where: { rentalRequestId: rental.id },
        orderBy: [{ kind: 'asc' }, { version: 'asc' }],
      });

      expect(docsV1).toHaveLength(2);
      const priorStudyV1 = docsV1.find((d) => d.kind === DocumentKind.PRIOR_STUDY);
      const contractV1 = docsV1.find((d) => d.kind === DocumentKind.CONTRACT);

      expect(priorStudyV1?.version).toBe(1);
      expect(contractV1?.version).toBe(1);

      // Verify Prior Study contents
      const studyHtml = priorStudyV1!.html;
      expect(studyHtml).toContain('ESTUDIO PREVIO — ARRENDAMIENTO DE ESPACIO CULTURAL');
      expect(studyHtml).toContain('Teatro Municipal Santiago Londoño');
      expect(studyHtml).toContain('Sala Principal');
      expect(studyHtml).toContain('Fundación Arte y Vida');
      expect(studyHtml).toContain('Marta Lucía Henao');
      // Normatividad aplicable strictly matching Vision doc
      expect(studyHtml).toContain('Ley 397 de 1997 – Ley General de Cultura');
      expect(studyHtml).toContain('Ley 1170 de 2007 – Ley de Teatro');
      expect(studyHtml).toContain('Ley 1493 de 2011 – Espectáculo público de las artes escénicas');
      expect(studyHtml).toContain('Decreto 1080 de 2015 – Decreto Único Reglamentario del Sector Cultura');
      expect(studyHtml).toContain('Acto Administrativo de especificaciones técnicas de alquiler de escenarios');
      expect(studyHtml).toContain('Acuerdo de Tarifas vigente');
      // Economic analysis
      expect(studyHtml).toContain('$ 3.200.000');
      expect(studyHtml).toContain('Tres millones doscientos mil pesos M/CTE');
      // Obligations & risks
      expect(studyHtml).toContain('Obligaciones principales del arrendatario');
      expect(studyHtml).toContain('Análisis de riesgos básicos');
      expect(studyHtml).toContain('Formato generado por SGEC — proyecto académico');

      // Verify Contract v1 contents (draft)
      const contractHtml = contractV1!.html;
      expect(contractHtml).toContain('CONTRATO DE ARRENDAMIENTO DE ESPACIO CULTURAL');
      expect(contractHtml).toContain('Pendiente de legalización');
      expect(contractHtml).toContain('SECRETARÍA DE CULTURA DEL MUNICIPIO DE PEREIRA');
      expect(contractHtml).toContain('SECRETARIO DE CULTURA DEL MUNICIPIO DE PEREIRA');
      expect(contractHtml).toContain('Fundación Arte y Vida');
      expect(contractHtml).toContain('Marta Lucía Henao');
      expect(contractHtml).toContain('CLÁUSULA PRIMERA — OBJETO');
      expect(contractHtml).toContain('CLÁUSULA SEGUNDA — PLAZO Y HORARIO');
      expect(contractHtml).toContain('CLÁUSULA TERCERA — VALOR Y FORMA DE PAGO');
      expect(contractHtml).toContain('CLÁUSULA CUARTA — OBLIGACIONES DEL ARRENDADOR');
      expect(contractHtml).toContain('CLÁUSULA QUINTA — OBLIGACIONES DEL ARRENDATARIO');
      expect(contractHtml).toContain('CLÁUSULA SEXTA — ENTREGA Y RECIBO DEL INMUEBLE');
      expect(contractHtml).toContain('CLÁUSULA SÉPTIMA — RESPONSABILIDAD POR DAÑOS');
      expect(contractHtml).toContain('CLÁUSULA OCTAVA — CLÁUSULAS ADICIONALES');
      expect(contractHtml).toContain('El arrendatario proveerá su propio equipo de microfonía inalámbrica');
      expect(contractHtml).toContain('CLÁUSULA NOVENA — NORMATIVIDAD APLICABLE Y JURISDICCIÓN');
      expect(contractHtml).toContain('Formato generado por SGEC — proyecto académico');

      // Second generation without specifying version -> auto increment to v2
      await renderer.generatePriorStudyAndContract(rental.id);
      const docsV2 = await prisma.generatedDocument.findMany({
        where: { rentalRequestId: rental.id },
        orderBy: [{ kind: 'asc' }, { version: 'asc' }],
      });
      expect(docsV2).toHaveLength(4);
      expect(docsV2.filter((d) => d.kind === DocumentKind.PRIOR_STUDY).map((d) => d.version)).toEqual([1, 2]);
      expect(docsV2.filter((d) => d.kind === DocumentKind.CONTRACT).map((d) => d.version)).toEqual([1, 2]);
    });
  });

  describe('generateFinalContract', () => {
    it('generates final CONTRACT with assigned contract number and signature (A-03, SPEC §11)', async () => {
      const user = await createUser();
      const venue = await createVenue({ name: 'Centro Cultural Lucy Tejada' });
      const space = await createSpace(venue.id, { name: 'Sala Múltiple' });
      const customer = await createCustomer({ name: 'Pedro Morales' });

      const rental = await prisma.rentalRequest.create({
        data: {
          customerId: customer.id,
          spaceId: space.id,
          eventName: 'Taller de Fotografía Urbana',
          eventDescription: 'Taller intensivo',
          purpose: EventPurpose.NON_LUCRATIVE,
          expectedAttendees: 30,
          startsAt: new Date('2026-11-01T14:00:00Z'),
          endsAt: new Date('2026-11-01T18:00:00Z'),
          channel: RequestChannel.EMAIL,
          status: RentalStatus.PENDING_SIGNATURE,
          quotedAmountPesos: 480000,
          createdById: user.id,
        },
      });

      const secretary = await createUser();

      await prisma.contract.create({
        data: {
          rentalRequestId: rental.id,
          number: 'ARR-2026-0001',
          object: 'Arrendamiento de Sala Múltiple para Taller de Fotografía',
          valuePesos: 480000,
          signedAt: new Date('2026-11-01T10:00:00Z'),
          signedById: secretary.id,
        },
      });

      // Existing draft v1
      await renderer.generatePriorStudyAndContract(rental.id, 1, user.id);

      // Generate final contract
      await renderer.generateFinalContract(rental.id, secretary.id);

      const finalDoc = await prisma.generatedDocument.findFirst({
        where: { rentalRequestId: rental.id, kind: DocumentKind.CONTRACT },
        orderBy: { version: 'desc' },
      });

      expect(finalDoc).toBeDefined();
      expect(finalDoc?.version).toBe(2);

      const html = finalDoc!.html;
      expect(html).toContain('No. ARR-2026-0001');
      expect(html).toContain('FIRMADO DIGITALMENTE');
      expect(html).toContain('SECRETARIO DE CULTURA DE PEREIRA');
      expect(html).toContain('ARR-2026-0001');
      expect(html).toContain('Formato generado por SGEC — proyecto académico');
    });
  });
});
