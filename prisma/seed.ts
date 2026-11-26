import {
  UserRole,
  PricingUnit,
  EventPurpose,
  CustomerType,
  RentalStatus,
  ReservationStatus,
  RequestChannel,
  LegalDecision,
  PrismaClient,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/infra/prisma.js';
import { DocumentRenderer } from '../src/modules/documents/documentRenderer.js';

export const SEED_USERS = [
  {
    email: 'jefe@sgec.local',
    name: 'Jefe de Oficina',
    role: UserRole.OFFICE_HEAD,
  },
  {
    email: 'auxiliar@sgec.local',
    name: 'Auxiliar Administrativo',
    role: UserRole.ADMIN_ASSISTANT,
  },
  {
    email: 'juridica@sgec.local',
    name: 'Abogado Jurídico',
    role: UserRole.LEGAL,
  },
  {
    email: 'secretario@sgec.local',
    name: 'Secretario de Cultura',
    role: UserRole.SECRETARY,
  },
  {
    email: 'operativo@sgec.local',
    name: 'Técnico Operativo',
    role: UserRole.OPERATIONS_TECH,
  },
  {
    email: 'mantenimiento@sgec.local',
    name: 'Técnico de Mantenimiento',
    role: UserRole.MAINTENANCE_TECH,
  },
];

export async function seedUsers(): Promise<void> {
  const passwordHash = await bcrypt.hash('Cambiar123!', 10);

  for (const user of SEED_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        passwordHash,
        active: true,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
        active: true,
      },
    });
  }
}

export async function seedCatalog(): Promise<void> {
  // Venue 1: Lucy Tejada
  const venueLucy = await prisma.venue.upsert({
    where: { id: 'venue-lucy-tejada' },
    update: {
      name: 'Centro Cultural Lucy Tejada',
      address: 'Carrera 9 y 10 con Calles 16 y 17, Pereira',
    },
    create: {
      id: 'venue-lucy-tejada',
      name: 'Centro Cultural Lucy Tejada',
      address: 'Carrera 9 y 10 con Calles 16 y 17, Pereira',
    },
  });

  // Space 1: Auditorio Principal (por hora)
  const spaceAuditorio = await prisma.space.upsert({
    where: { id: 'space-auditorio-principal' },
    update: {
      name: 'Auditorio Principal',
      capacity: 200,
      pricingUnit: PricingUnit.HOUR,
      active: true,
      venueId: venueLucy.id,
    },
    create: {
      id: 'space-auditorio-principal',
      venueId: venueLucy.id,
      name: 'Auditorio Principal',
      capacity: 200,
      pricingUnit: PricingUnit.HOUR,
      active: true,
    },
  });

  // Tariffs Auditorio
  await prisma.tariff.upsert({
    where: { id: 'tariff-aud-luc' },
    update: {
      spaceId: spaceAuditorio.id,
      purpose: EventPurpose.LUCRATIVE,
      unit: PricingUnit.HOUR,
      pricePesos: 450000,
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validTo: null,
    },
    create: {
      id: 'tariff-aud-luc',
      spaceId: spaceAuditorio.id,
      purpose: EventPurpose.LUCRATIVE,
      unit: PricingUnit.HOUR,
      pricePesos: 450000,
      validFrom: new Date('2026-01-01T00:00:00Z'),
    },
  });

  await prisma.tariff.upsert({
    where: { id: 'tariff-aud-non-luc' },
    update: {
      spaceId: spaceAuditorio.id,
      purpose: EventPurpose.NON_LUCRATIVE,
      unit: PricingUnit.HOUR,
      pricePesos: 250000,
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validTo: null,
    },
    create: {
      id: 'tariff-aud-non-luc',
      spaceId: spaceAuditorio.id,
      purpose: EventPurpose.NON_LUCRATIVE,
      unit: PricingUnit.HOUR,
      pricePesos: 250000,
      validFrom: new Date('2026-01-01T00:00:00Z'),
    },
  });

  // Space 2: Sala Múltiple (por hora)
  const spaceMultiple = await prisma.space.upsert({
    where: { id: 'space-sala-multiple' },
    update: {
      name: 'Sala Múltiple',
      capacity: 80,
      pricingUnit: PricingUnit.HOUR,
      active: true,
      venueId: venueLucy.id,
    },
    create: {
      id: 'space-sala-multiple',
      venueId: venueLucy.id,
      name: 'Sala Múltiple',
      capacity: 80,
      pricingUnit: PricingUnit.HOUR,
      active: true,
    },
  });

  // Tariffs Sala Múltiple
  await prisma.tariff.upsert({
    where: { id: 'tariff-mult-luc' },
    update: {
      spaceId: spaceMultiple.id,
      purpose: EventPurpose.LUCRATIVE,
      unit: PricingUnit.HOUR,
      pricePesos: 200000,
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validTo: null,
    },
    create: {
      id: 'tariff-mult-luc',
      spaceId: spaceMultiple.id,
      purpose: EventPurpose.LUCRATIVE,
      unit: PricingUnit.HOUR,
      pricePesos: 200000,
      validFrom: new Date('2026-01-01T00:00:00Z'),
    },
  });

  await prisma.tariff.upsert({
    where: { id: 'tariff-mult-non-luc' },
    update: {
      spaceId: spaceMultiple.id,
      purpose: EventPurpose.NON_LUCRATIVE,
      unit: PricingUnit.HOUR,
      pricePesos: 120000,
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validTo: null,
    },
    create: {
      id: 'tariff-mult-non-luc',
      spaceId: spaceMultiple.id,
      purpose: EventPurpose.NON_LUCRATIVE,
      unit: PricingUnit.HOUR,
      pricePesos: 120000,
      validFrom: new Date('2026-01-01T00:00:00Z'),
    },
  });

  // Venue 2: Santiago Londoño
  const venueLondono = await prisma.venue.upsert({
    where: { id: 'venue-santiago-londono' },
    update: {
      name: 'Teatro Municipal Santiago Londoño',
      address: 'Carrera 12 con Calle 18, Pereira',
    },
    create: {
      id: 'venue-santiago-londono',
      name: 'Teatro Municipal Santiago Londoño',
      address: 'Carrera 12 con Calle 18, Pereira',
    },
  });

  // Space 3: Sala Principal (por día)
  const spacePrincipal = await prisma.space.upsert({
    where: { id: 'space-sala-principal' },
    update: {
      name: 'Sala Principal',
      capacity: 800,
      pricingUnit: PricingUnit.DAY,
      active: true,
      venueId: venueLondono.id,
    },
    create: {
      id: 'space-sala-principal',
      venueId: venueLondono.id,
      name: 'Sala Principal',
      capacity: 800,
      pricingUnit: PricingUnit.DAY,
      active: true,
    },
  });

  // Tariffs Teatro
  await prisma.tariff.upsert({
    where: { id: 'tariff-lon-luc' },
    update: {
      spaceId: spacePrincipal.id,
      purpose: EventPurpose.LUCRATIVE,
      unit: PricingUnit.DAY,
      pricePesos: 3200000,
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validTo: null,
    },
    create: {
      id: 'tariff-lon-luc',
      spaceId: spacePrincipal.id,
      purpose: EventPurpose.LUCRATIVE,
      unit: PricingUnit.DAY,
      pricePesos: 3200000,
      validFrom: new Date('2026-01-01T00:00:00Z'),
    },
  });

  await prisma.tariff.upsert({
    where: { id: 'tariff-lon-non-luc' },
    update: {
      spaceId: spacePrincipal.id,
      purpose: EventPurpose.NON_LUCRATIVE,
      unit: PricingUnit.DAY,
      pricePesos: 1800000,
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validTo: null,
    },
    create: {
      id: 'tariff-lon-non-luc',
      spaceId: spacePrincipal.id,
      purpose: EventPurpose.NON_LUCRATIVE,
      unit: PricingUnit.DAY,
      pricePesos: 1800000,
      validFrom: new Date('2026-01-01T00:00:00Z'),
    },
  });
}

export async function seedDocumentRequirements(): Promise<void> {
  const requirements = [
    // Persona Natural
    {
      customerType: CustomerType.NATURAL,
      code: 'CC',
      name: 'Documento de identidad (cédula de ciudadanía o extranjería)',
      mandatory: true,
    },
    {
      customerType: CustomerType.NATURAL,
      code: 'RUT',
      name: 'Registro Único Tributario (RUT) actualizado',
      mandatory: true,
    },
    {
      customerType: CustomerType.NATURAL,
      code: 'EVENT_DESC',
      name: 'Descripción detallada del evento y requerimientos técnicos',
      mandatory: true,
    },
    // Persona Jurídica
    {
      customerType: CustomerType.LEGAL,
      code: 'CERT_EXISTENCE',
      name: 'Certificado de existencia y representación legal vigente (Cámara de Comercio)',
      mandatory: true,
    },
    {
      customerType: CustomerType.LEGAL,
      code: 'RUT',
      name: 'Registro Único Tributario (RUT) actualizado',
      mandatory: true,
    },
    {
      customerType: CustomerType.LEGAL,
      code: 'REP_DOC',
      name: 'Documento de identidad del representante legal',
      mandatory: true,
    },
    {
      customerType: CustomerType.LEGAL,
      code: 'EVENT_DESC',
      name: 'Descripción detallada del evento y requerimientos técnicos',
      mandatory: true,
    },
  ];

  for (const req of requirements) {
    await prisma.documentRequirement.upsert({
      where: {
        customerType_code: {
          customerType: req.customerType,
          code: req.code,
        },
      },
      update: {
        name: req.name,
        mandatory: req.mandatory,
      },
      create: req,
    });
  }
}

export const DEMO_RENTAL_IDS = [
  'rental-demo-01-registered',
  'rental-demo-02-responded',
  'rental-demo-03-doc-verified',
  'rental-demo-04-contract-drafted',
  'rental-demo-05-paid',
  'rental-demo-06-legal-review',
  'rental-demo-07-returned-by-legal',
  'rental-demo-08-pending-signature',
  'rental-demo-09-legalized',
  'rental-demo-10-cancelled',
];

export const DEMO_CUSTOMER_IDS = [
  'customer-demo-01',
  'customer-demo-02',
  'customer-demo-03',
  'customer-demo-04',
  'customer-demo-05',
  'customer-demo-06',
  'customer-demo-07',
  'customer-demo-08',
  'customer-demo-09',
  'customer-demo-10',
];

export async function seedDemoRentals(prismaClient: PrismaClient = prisma): Promise<void> {
  const auxiliar = await prismaClient.user.findUniqueOrThrow({
    where: { email: 'auxiliar@sgec.local' },
  });
  const juridica = await prismaClient.user.findUniqueOrThrow({
    where: { email: 'juridica@sgec.local' },
  });
  const secretario = await prismaClient.user.findUniqueOrThrow({
    where: { email: 'secretario@sgec.local' },
  });
  const jefe = await prismaClient.user.findUniqueOrThrow({
    where: { email: 'jefe@sgec.local' },
  });

  const now = new Date();
  const getSlot = (dayOffset: number, startHour: number, durationHours: number) => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, startHour, 0, 0, 0);
    const end = new Date(start.getTime() + durationHours * 3600 * 1000);
    return { start, end };
  };

  const buildDocs = (
    customerType: CustomerType,
    verified: boolean,
    verifiedById?: string,
  ) => {
    const codes =
      customerType === CustomerType.NATURAL
        ? ['CC', 'RUT', 'EVENT_DESC']
        : ['CERT_EXISTENCE', 'RUT', 'REP_DOC', 'EVENT_DESC'];

    return codes.map((code) => ({
      requirementCode: code,
      receivedAt: verified ? now : null,
      verifiedAt: verified ? now : null,
      verifiedById: verified ? verifiedById : null,
      notes: verified ? 'Documento verificado y conforme a requisitos' : null,
      createdById: auxiliar.id,
    }));
  };

  await prismaClient.$transaction(async (tx) => {
    // 1. Limpieza de datos demo previos para garantizar idempotencia estricta
    await tx.generatedDocument.deleteMany({
      where: { rentalRequestId: { in: DEMO_RENTAL_IDS } },
    });
    await tx.stateTransition.deleteMany({
      where: { rentalRequestId: { in: DEMO_RENTAL_IDS } },
    });
    await tx.legalReview.deleteMany({
      where: { rentalRequestId: { in: DEMO_RENTAL_IDS } },
    });
    await tx.payment.deleteMany({
      where: { rentalRequestId: { in: DEMO_RENTAL_IDS } },
    });
    await tx.contract.deleteMany({
      where: {
        OR: [
          { rentalRequestId: { in: DEMO_RENTAL_IDS } },
          { number: 'ARR-2026-0001' },
        ],
      },
    });
    await tx.requestDocument.deleteMany({
      where: { rentalRequestId: { in: DEMO_RENTAL_IDS } },
    });
    await tx.reservation.deleteMany({
      where: { rentalRequestId: { in: DEMO_RENTAL_IDS } },
    });
    await tx.rentalRequest.deleteMany({
      where: { id: { in: DEMO_RENTAL_IDS } },
    });
    await tx.customer.deleteMany({
      where: {
        OR: [
          { id: { in: DEMO_CUSTOMER_IDS } },
          {
            documentNumber: {
              in: [
                '1088234567',
                '1088345678',
                '1088456789',
                '900123456-1',
                '1088567890',
                '900234567-2',
                '1088678901',
                '1088789012',
                '900345678-3',
                '1088890123',
              ],
            },
          },
        ],
      },
    });

    // 2. Creación de clientes demo
    const customers = [
      {
        id: 'customer-demo-01',
        type: CustomerType.NATURAL,
        documentType: 'CC',
        documentNumber: '1088234567',
        name: 'María Camila Restrepo',
        email: 'camila.restrepo@example.com',
        phone: '3105550101',
        address: 'Carrera 7 # 21-45, Pereira',
      },
      {
        id: 'customer-demo-02',
        type: CustomerType.NATURAL,
        documentType: 'CC',
        documentNumber: '1088345678',
        name: 'Jorge Iván Gómez',
        email: 'jorge.gomez@example.com',
        phone: '3115550102',
        address: 'Calle 19 # 8-30, Pereira',
      },
      {
        id: 'customer-demo-03',
        type: CustomerType.NATURAL,
        documentType: 'CC',
        documentNumber: '1088456789',
        name: 'Ana Lucía Jaramillo',
        email: 'ana.jaramillo@example.com',
        phone: '3125550103',
        address: 'Manzana 12 Casa 4, Barrio Boston, Pereira',
      },
      {
        id: 'customer-demo-04',
        type: CustomerType.LEGAL,
        documentType: 'NIT',
        documentNumber: '900123456-1',
        name: 'Fundación Cultural Arte y Café',
        legalRepresentative: 'Carlos Alberto Vélez',
        email: 'contacto@arteycafe.org',
        phone: '3135550104',
        address: 'Avenida Las Américas # 45-12, Pereira',
      },
      {
        id: 'customer-demo-05',
        type: CustomerType.NATURAL,
        documentType: 'CC',
        documentNumber: '1088567890',
        name: 'Fernando Quintero',
        email: 'fernando.quintero@example.com',
        phone: '3145550105',
        address: 'Calle 24 # 5-18, Pereira',
      },
      {
        id: 'customer-demo-06',
        type: CustomerType.LEGAL,
        documentType: 'NIT',
        documentNumber: '900234567-2',
        name: 'Asociación Teatral de Risaralda',
        legalRepresentative: 'Diana Marcela Osorio',
        email: 'direccion@teatrorisaralda.com',
        phone: '3155550106',
        address: 'Carrera 13 # 22-50, Pereira',
      },
      {
        id: 'customer-demo-07',
        type: CustomerType.NATURAL,
        documentType: 'CC',
        documentNumber: '1088678901',
        name: 'Sandra Milena Castaño',
        email: 'sandra.castano@example.com',
        phone: '3165550107',
        address: 'Carrera 6 # 15-32, Pereira',
      },
      {
        id: 'customer-demo-08',
        type: CustomerType.NATURAL,
        documentType: 'CC',
        documentNumber: '1088789012',
        name: 'Andrés Felipe Cardona',
        email: 'andres.cardona@example.com',
        phone: '3175550108',
        address: 'Manzana 4 Casa 18, Barrio Álamos, Pereira',
      },
      {
        id: 'customer-demo-09',
        type: CustomerType.LEGAL,
        documentType: 'NIT',
        documentNumber: '900345678-3',
        name: 'Compañía Filarmónica de Pereira',
        legalRepresentative: 'Gustavo Adolfo Rendón',
        email: 'gerencia@filarmonicapereira.org',
        phone: '3185550109',
        address: 'Carrera 7 # 18-55, Pereira',
      },
      {
        id: 'customer-demo-10',
        type: CustomerType.NATURAL,
        documentType: 'CC',
        documentNumber: '1088890123',
        name: 'Patricia Elena Salazar',
        email: 'patricia.salazar@example.com',
        phone: '3195550110',
        address: 'Carrera 11 # 14-22, Pereira',
      },
    ];

    for (const c of customers) {
      await tx.customer.create({
        data: {
          ...c,
          createdById: auxiliar.id,
        },
      });
    }

    // 3. Solicitud 1: REGISTERED
    // Cliente persona natural, Auditorio Principal, mañana, 2h
    const slot1 = getSlot(1, 9, 2);
    await tx.rentalRequest.create({
      data: {
        id: 'rental-demo-01-registered',
        status: RentalStatus.REGISTERED,
        customerId: 'customer-demo-01',
        spaceId: 'space-auditorio-principal',
        eventName: 'Taller de Poesía y Creación Literaria Risaraldense',
        eventDescription: 'Taller abierto para jóvenes talentos de Pereira sobre tradición poética y cuento corto.',
        purpose: EventPurpose.NON_LUCRATIVE,
        expectedAttendees: 80,
        startsAt: slot1.start,
        endsAt: slot1.end,
        channel: RequestChannel.WRITTEN,
        requestRadicado: 'RAD-2026-IN-0101',
        createdById: auxiliar.id,
        reservations: {
          create: {
            id: 'res-demo-01',
            spaceId: 'space-auditorio-principal',
            startsAt: slot1.start,
            endsAt: slot1.end,
            status: ReservationStatus.HELD,
            createdById: auxiliar.id,
          },
        },
        requestDocuments: {
          create: buildDocs(CustomerType.NATURAL, false),
        },
        stateTransitions: {
          create: [
            {
              transition: 'register',
              fromStatus: null,
              toStatus: 'REGISTERED',
              actorId: auxiliar.id,
              note: 'Solicitud radicada por ventanilla única',
              occurredAt: new Date(now.getTime() - 3600000 * 24),
            },
          ],
        },
      },
    });

    // 4. Solicitud 2: RESPONDED
    // Respuesta con radicado y cotización congelada + oficio generado
    const slot2 = getSlot(2, 14, 3);
    await tx.rentalRequest.create({
      data: {
        id: 'rental-demo-02-responded',
        status: RentalStatus.RESPONDED,
        customerId: 'customer-demo-02',
        spaceId: 'space-auditorio-principal',
        eventName: 'Conferencia de Emprendimiento Cultural y Naranja',
        eventDescription: 'Capacitación en formalización de proyectos culturales y economía creativa.',
        purpose: EventPurpose.NON_LUCRATIVE,
        expectedAttendees: 120,
        startsAt: slot2.start,
        endsAt: slot2.end,
        channel: RequestChannel.EMAIL,
        requestRadicado: 'RAD-2026-IN-0102',
        responseRadicado: 'RAD-2026-OUT-0102',
        quotedTariffId: 'tariff-aud-non-luc',
        quotedAmountPesos: 750000,
        createdById: auxiliar.id,
        reservations: {
          create: {
            id: 'res-demo-02',
            spaceId: 'space-auditorio-principal',
            startsAt: slot2.start,
            endsAt: slot2.end,
            status: ReservationStatus.HELD,
            createdById: auxiliar.id,
          },
        },
        requestDocuments: {
          create: buildDocs(CustomerType.NATURAL, false),
        },
        stateTransitions: {
          create: [
            {
              transition: 'register',
              fromStatus: null,
              toStatus: 'REGISTERED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 20),
            },
            {
              transition: 'respond',
              fromStatus: 'REGISTERED',
              toStatus: 'RESPONDED',
              actorId: auxiliar.id,
              note: 'Cotización congelada y oficio de respuesta emitido',
              occurredAt: new Date(now.getTime() - 3600000 * 18),
            },
          ],
        },
      },
    });

    // 5. Solicitud 3: DOCUMENTS_VERIFIED
    // Ídem + documentos marcados como verificados
    const slot3 = getSlot(3, 10, 3);
    await tx.rentalRequest.create({
      data: {
        id: 'rental-demo-03-doc-verified',
        status: RentalStatus.DOCUMENTS_VERIFIED,
        customerId: 'customer-demo-03',
        spaceId: 'space-sala-multiple',
        eventName: 'Lanzamiento de Libro Crónicas del Otún',
        eventDescription: 'Presentación de libro histórico sobre el río Otún y la cuenca cafetera.',
        purpose: EventPurpose.NON_LUCRATIVE,
        expectedAttendees: 50,
        startsAt: slot3.start,
        endsAt: slot3.end,
        channel: RequestChannel.WRITTEN,
        requestRadicado: 'RAD-2026-IN-0103',
        responseRadicado: 'RAD-2026-OUT-0103',
        quotedTariffId: 'tariff-mult-non-luc',
        quotedAmountPesos: 360000,
        createdById: auxiliar.id,
        reservations: {
          create: {
            id: 'res-demo-03',
            spaceId: 'space-sala-multiple',
            startsAt: slot3.start,
            endsAt: slot3.end,
            status: ReservationStatus.HELD,
            createdById: auxiliar.id,
          },
        },
        requestDocuments: {
          create: buildDocs(CustomerType.NATURAL, true, auxiliar.id),
        },
        stateTransitions: {
          create: [
            {
              transition: 'register',
              fromStatus: null,
              toStatus: 'REGISTERED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 16),
            },
            {
              transition: 'respond',
              fromStatus: 'REGISTERED',
              toStatus: 'RESPONDED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 14),
            },
            {
              transition: 'verifyDocuments',
              fromStatus: 'RESPONDED',
              toStatus: 'DOCUMENTS_VERIFIED',
              actorId: auxiliar.id,
              note: 'Checklist documental verificado a satisfacción',
              occurredAt: new Date(now.getTime() - 3600000 * 12),
            },
          ],
        },
      },
    });

    // 6. Solicitud 4: CONTRACT_DRAFTED
    // Ídem + contrato elaborado
    const slot4 = getSlot(4, 14, 4);
    await tx.rentalRequest.create({
      data: {
        id: 'rental-demo-04-contract-drafted',
        status: RentalStatus.CONTRACT_DRAFTED,
        customerId: 'customer-demo-04',
        spaceId: 'space-sala-multiple',
        eventName: 'Muestra de Cortometrajes Cafeteros',
        eventDescription: 'Exhibición y concurso de cortometrajes universitarios de la región del Eje Cafetero.',
        purpose: EventPurpose.LUCRATIVE,
        expectedAttendees: 70,
        startsAt: slot4.start,
        endsAt: slot4.end,
        channel: RequestChannel.EMAIL,
        requestRadicado: 'RAD-2026-IN-0104',
        responseRadicado: 'RAD-2026-OUT-0104',
        quotedTariffId: 'tariff-mult-luc',
        quotedAmountPesos: 800000,
        createdById: auxiliar.id,
        reservations: {
          create: {
            id: 'res-demo-04',
            spaceId: 'space-sala-multiple',
            startsAt: slot4.start,
            endsAt: slot4.end,
            status: ReservationStatus.HELD,
            createdById: auxiliar.id,
          },
        },
        requestDocuments: {
          create: buildDocs(CustomerType.LEGAL, true, auxiliar.id),
        },
        contract: {
          create: {
            id: 'contract-demo-04',
            object: 'Arrendamiento de la Sala Múltiple del Centro Cultural Lucy Tejada para el evento Muestra de Cortometrajes Cafeteros',
            valuePesos: 800000,
            additionalClauses: 'El arrendatario se compromete al uso adecuado y custodia de los equipos audiovisuales suministrados.',
            createdById: auxiliar.id,
          },
        },
        stateTransitions: {
          create: [
            {
              transition: 'register',
              fromStatus: null,
              toStatus: 'REGISTERED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 15),
            },
            {
              transition: 'respond',
              fromStatus: 'REGISTERED',
              toStatus: 'RESPONDED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 13),
            },
            {
              transition: 'verifyDocuments',
              fromStatus: 'RESPONDED',
              toStatus: 'DOCUMENTS_VERIFIED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 10),
            },
            {
              transition: 'draftContract',
              fromStatus: 'DOCUMENTS_VERIFIED',
              toStatus: 'CONTRACT_DRAFTED',
              actorId: auxiliar.id,
              note: 'Estudio previo y minuta elaborados',
              occurredAt: new Date(now.getTime() - 3600000 * 8),
            },
          ],
        },
      },
    });

    // 7. Solicitud 5: PAID
    // Ídem + pago registrado
    const slot5 = getSlot(5, 17, 3);
    await tx.rentalRequest.create({
      data: {
        id: 'rental-demo-05-paid',
        status: RentalStatus.PAID,
        customerId: 'customer-demo-05',
        spaceId: 'space-auditorio-principal',
        eventName: 'Recital de Guitarra Clásica y Cuerdas Andinas',
        eventDescription: 'Concierto acústico de música instrumental andina y colombiana.',
        purpose: EventPurpose.NON_LUCRATIVE,
        expectedAttendees: 160,
        startsAt: slot5.start,
        endsAt: slot5.end,
        channel: RequestChannel.WRITTEN,
        requestRadicado: 'RAD-2026-IN-0105',
        responseRadicado: 'RAD-2026-OUT-0105',
        quotedTariffId: 'tariff-aud-non-luc',
        quotedAmountPesos: 750000,
        createdById: auxiliar.id,
        reservations: {
          create: {
            id: 'res-demo-05',
            spaceId: 'space-auditorio-principal',
            startsAt: slot5.start,
            endsAt: slot5.end,
            status: ReservationStatus.HELD,
            createdById: auxiliar.id,
          },
        },
        requestDocuments: {
          create: buildDocs(CustomerType.NATURAL, true, auxiliar.id),
        },
        contract: {
          create: {
            id: 'contract-demo-05',
            object: 'Arrendamiento del Auditorio Principal para Recital de Guitarra Clásica y Cuerdas Andinas',
            valuePesos: 750000,
            additionalClauses: 'El organizador coordinará con el técnico de sonido las pruebas acústicas previas.',
            createdById: auxiliar.id,
          },
        },
        payment: {
          create: {
            id: 'payment-demo-05',
            receiptNumber: 'REC-2026-0045',
            bankName: 'Banco de Occidente',
            voucherNumber: 'VOUCH-78901',
            paidAt: new Date(now.getTime() - 3600000 * 6),
            amountPesos: 750000,
            invoiceNumber: 'FE-2026-0045',
            invoiceDate: new Date(now.getTime() - 3600000 * 6),
            createdById: auxiliar.id,
          },
        },
        stateTransitions: {
          create: [
            {
              transition: 'register',
              fromStatus: null,
              toStatus: 'REGISTERED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 14),
            },
            {
              transition: 'respond',
              fromStatus: 'REGISTERED',
              toStatus: 'RESPONDED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 12),
            },
            {
              transition: 'verifyDocuments',
              fromStatus: 'RESPONDED',
              toStatus: 'DOCUMENTS_VERIFIED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 9),
            },
            {
              transition: 'draftContract',
              fromStatus: 'DOCUMENTS_VERIFIED',
              toStatus: 'CONTRACT_DRAFTED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 7),
            },
            {
              transition: 'registerPayment',
              fromStatus: 'CONTRACT_DRAFTED',
              toStatus: 'PAID',
              actorId: auxiliar.id,
              note: 'Pago verificado con comprobante de tesorería',
              occurredAt: new Date(now.getTime() - 3600000 * 5),
            },
          ],
        },
      },
    });

    // 8. Solicitud 6: LEGAL_REVIEW
    // Ídem + enviada a jurídica
    const slot6 = getSlot(6, 8, 14);
    await tx.rentalRequest.create({
      data: {
        id: 'rental-demo-06-legal-review',
        status: RentalStatus.LEGAL_REVIEW,
        customerId: 'customer-demo-06',
        spaceId: 'space-sala-principal',
        eventName: 'Festival Regional de Artes Escénicas y Teatro Comunitario',
        eventDescription: 'Jornada cultural de muestras teatrales comunitarias del departamento de Risaralda.',
        purpose: EventPurpose.NON_LUCRATIVE,
        expectedAttendees: 600,
        startsAt: slot6.start,
        endsAt: slot6.end,
        channel: RequestChannel.EMAIL,
        requestRadicado: 'RAD-2026-IN-0106',
        responseRadicado: 'RAD-2026-OUT-0106',
        quotedTariffId: 'tariff-lon-non-luc',
        quotedAmountPesos: 1800000,
        createdById: auxiliar.id,
        reservations: {
          create: {
            id: 'res-demo-06',
            spaceId: 'space-sala-principal',
            startsAt: slot6.start,
            endsAt: slot6.end,
            status: ReservationStatus.HELD,
            createdById: auxiliar.id,
          },
        },
        requestDocuments: {
          create: buildDocs(CustomerType.LEGAL, true, auxiliar.id),
        },
        contract: {
          create: {
            id: 'contract-demo-06',
            object: 'Arrendamiento de la Sala Principal del Teatro Municipal Santiago Londoño para Festival Regional de Artes Escénicas',
            valuePesos: 1800000,
            additionalClauses: 'Se coordinará el acceso del personal de tramoya y luces con 4 horas de anticipación.',
            createdById: auxiliar.id,
          },
        },
        payment: {
          create: {
            id: 'payment-demo-06',
            receiptNumber: 'REC-2026-0052',
            bankName: 'Bancolombia',
            voucherNumber: 'VOUCH-89012',
            paidAt: new Date(now.getTime() - 3600000 * 5),
            amountPesos: 1800000,
            invoiceNumber: 'FE-2026-0052',
            invoiceDate: new Date(now.getTime() - 3600000 * 5),
            createdById: auxiliar.id,
          },
        },
        stateTransitions: {
          create: [
            {
              transition: 'register',
              fromStatus: null,
              toStatus: 'REGISTERED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 12),
            },
            {
              transition: 'respond',
              fromStatus: 'REGISTERED',
              toStatus: 'RESPONDED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 10),
            },
            {
              transition: 'verifyDocuments',
              fromStatus: 'RESPONDED',
              toStatus: 'DOCUMENTS_VERIFIED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 8),
            },
            {
              transition: 'draftContract',
              fromStatus: 'DOCUMENTS_VERIFIED',
              toStatus: 'CONTRACT_DRAFTED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 6),
            },
            {
              transition: 'registerPayment',
              fromStatus: 'CONTRACT_DRAFTED',
              toStatus: 'PAID',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 4),
            },
            {
              transition: 'submitToLegal',
              fromStatus: 'PAID',
              toStatus: 'LEGAL_REVIEW',
              actorId: auxiliar.id,
              note: 'Expediente completo remitido a Jurídica para revisión',
              occurredAt: new Date(now.getTime() - 3600000 * 2),
            },
          ],
        },
      },
    });

    // 9. Solicitud 7: RETURNED_BY_LEGAL
    // Ídem + devuelta por jurídica con observación
    const slot7 = getSlot(8, 8, 4);
    await tx.rentalRequest.create({
      data: {
        id: 'rental-demo-07-returned-by-legal',
        status: RentalStatus.RETURNED_BY_LEGAL,
        customerId: 'customer-demo-07',
        spaceId: 'space-auditorio-principal',
        eventName: 'Foro de Innovación y Gestión Cultural de Risaralda',
        eventDescription: 'Encuentro de gestores culturales sobre mecanismos de financiación mixta.',
        purpose: EventPurpose.NON_LUCRATIVE,
        expectedAttendees: 150,
        startsAt: slot7.start,
        endsAt: slot7.end,
        channel: RequestChannel.WRITTEN,
        requestRadicado: 'RAD-2026-IN-0107',
        responseRadicado: 'RAD-2026-OUT-0107',
        quotedTariffId: 'tariff-aud-non-luc',
        quotedAmountPesos: 1000000,
        createdById: auxiliar.id,
        reservations: {
          create: {
            id: 'res-demo-07',
            spaceId: 'space-auditorio-principal',
            startsAt: slot7.start,
            endsAt: slot7.end,
            status: ReservationStatus.HELD,
            createdById: auxiliar.id,
          },
        },
        requestDocuments: {
          create: buildDocs(CustomerType.NATURAL, true, auxiliar.id),
        },
        contract: {
          create: {
            id: 'contract-demo-07',
            object: 'Arrendamiento del Auditorio Principal para Foro de Innovación Cultural',
            valuePesos: 1000000,
            additionalClauses: 'El arrendatario deberá constituir póliza de cumplimiento.',
            createdById: auxiliar.id,
          },
        },
        payment: {
          create: {
            id: 'payment-demo-07',
            receiptNumber: 'REC-2026-0061',
            bankName: 'Davivienda',
            voucherNumber: 'VOUCH-90123',
            paidAt: new Date(now.getTime() - 3600000 * 6),
            amountPesos: 1000000,
            invoiceNumber: 'FE-2026-0061',
            invoiceDate: new Date(now.getTime() - 3600000 * 6),
            createdById: auxiliar.id,
          },
        },
        legalReviews: {
          create: {
            id: 'legal-review-demo-07',
            round: 1,
            reviewerId: juridica.id,
            documentsOk: true,
            customerDataOk: true,
            clausesOk: false,
            decision: LegalDecision.RETURNED,
            observations: 'Aclarar en el estudio previo el alcance de la póliza de cumplimiento y ajustar la cláusula de indemnidad.',
            reviewedAt: new Date(now.getTime() - 3600000 * 2),
          },
        },
        stateTransitions: {
          create: [
            {
              transition: 'register',
              fromStatus: null,
              toStatus: 'REGISTERED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 14),
            },
            {
              transition: 'respond',
              fromStatus: 'REGISTERED',
              toStatus: 'RESPONDED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 12),
            },
            {
              transition: 'verifyDocuments',
              fromStatus: 'RESPONDED',
              toStatus: 'DOCUMENTS_VERIFIED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 10),
            },
            {
              transition: 'draftContract',
              fromStatus: 'DOCUMENTS_VERIFIED',
              toStatus: 'CONTRACT_DRAFTED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 8),
            },
            {
              transition: 'registerPayment',
              fromStatus: 'CONTRACT_DRAFTED',
              toStatus: 'PAID',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 6),
            },
            {
              transition: 'submitToLegal',
              fromStatus: 'PAID',
              toStatus: 'LEGAL_REVIEW',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 4),
            },
            {
              transition: 'returnLegal',
              fromStatus: 'LEGAL_REVIEW',
              toStatus: 'RETURNED_BY_LEGAL',
              actorId: juridica.id,
              note: 'Aclarar en el estudio previo el alcance de la póliza de cumplimiento y ajustar la cláusula de indemnidad.',
              occurredAt: new Date(now.getTime() - 3600000 * 2),
            },
          ],
        },
      },
    });

    // 10. Solicitud 8: PENDING_SIGNATURE
    // Ídem + aprobada por jurídica
    const slot8 = getSlot(9, 14, 4);
    await tx.rentalRequest.create({
      data: {
        id: 'rental-demo-08-pending-signature',
        status: RentalStatus.PENDING_SIGNATURE,
        customerId: 'customer-demo-08',
        spaceId: 'space-sala-multiple',
        eventName: 'Taller Magistral de Cerámica y Escultura',
        eventDescription: 'Taller práctico intensivo para artesanos y artistas plásticos.',
        purpose: EventPurpose.LUCRATIVE,
        expectedAttendees: 40,
        startsAt: slot8.start,
        endsAt: slot8.end,
        channel: RequestChannel.EMAIL,
        requestRadicado: 'RAD-2026-IN-0108',
        responseRadicado: 'RAD-2026-OUT-0108',
        quotedTariffId: 'tariff-mult-luc',
        quotedAmountPesos: 800000,
        createdById: auxiliar.id,
        reservations: {
          create: {
            id: 'res-demo-08',
            spaceId: 'space-sala-multiple',
            startsAt: slot8.start,
            endsAt: slot8.end,
            status: ReservationStatus.HELD,
            createdById: auxiliar.id,
          },
        },
        requestDocuments: {
          create: buildDocs(CustomerType.NATURAL, true, auxiliar.id),
        },
        contract: {
          create: {
            id: 'contract-demo-08',
            object: 'Arrendamiento de la Sala Múltiple para Taller de Cerámica y Escultura',
            valuePesos: 800000,
            additionalClauses: 'El organizador responderá por el aseo final y disposición de residuos de arcilla.',
            createdById: auxiliar.id,
          },
        },
        payment: {
          create: {
            id: 'payment-demo-08',
            receiptNumber: 'REC-2026-0070',
            bankName: 'Banco de Bogotá',
            voucherNumber: 'VOUCH-01234',
            paidAt: new Date(now.getTime() - 3600000 * 5),
            amountPesos: 800000,
            invoiceNumber: 'FE-2026-0070',
            invoiceDate: new Date(now.getTime() - 3600000 * 5),
            createdById: auxiliar.id,
          },
        },
        legalReviews: {
          create: {
            id: 'legal-review-demo-08',
            round: 1,
            reviewerId: juridica.id,
            documentsOk: true,
            customerDataOk: true,
            clausesOk: true,
            decision: LegalDecision.APPROVED,
            observations: 'Estudio previo, minuta y comprobante de pago verificados a satisfacción.',
            reviewedAt: new Date(now.getTime() - 3600000 * 2),
          },
        },
        stateTransitions: {
          create: [
            {
              transition: 'register',
              fromStatus: null,
              toStatus: 'REGISTERED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 14),
            },
            {
              transition: 'respond',
              fromStatus: 'REGISTERED',
              toStatus: 'RESPONDED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 12),
            },
            {
              transition: 'verifyDocuments',
              fromStatus: 'RESPONDED',
              toStatus: 'DOCUMENTS_VERIFIED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 10),
            },
            {
              transition: 'draftContract',
              fromStatus: 'DOCUMENTS_VERIFIED',
              toStatus: 'CONTRACT_DRAFTED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 8),
            },
            {
              transition: 'registerPayment',
              fromStatus: 'CONTRACT_DRAFTED',
              toStatus: 'PAID',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 6),
            },
            {
              transition: 'submitToLegal',
              fromStatus: 'PAID',
              toStatus: 'LEGAL_REVIEW',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 4),
            },
            {
              transition: 'approveLegal',
              fromStatus: 'LEGAL_REVIEW',
              toStatus: 'PENDING_SIGNATURE',
              actorId: juridica.id,
              note: 'Concepto favorable emitido, pasa a firma del Secretario',
              occurredAt: new Date(now.getTime() - 3600000 * 2),
            },
          ],
        },
      },
    });

    // 11. Solicitud 9: LEGALIZED
    // Ídem + firmada y numerada (ARR-2026-0001)
    const slot9 = getSlot(10, 8, 14);
    await tx.rentalRequest.create({
      data: {
        id: 'rental-demo-09-legalized',
        status: RentalStatus.LEGALIZED,
        customerId: 'customer-demo-09',
        spaceId: 'space-sala-principal',
        eventName: 'Concierto de Gala Aniversario de Pereira',
        eventDescription: 'Gran velada sinfónica con solistas invitados y repertorio conmemorativo.',
        purpose: EventPurpose.LUCRATIVE,
        expectedAttendees: 750,
        startsAt: slot9.start,
        endsAt: slot9.end,
        channel: RequestChannel.WRITTEN,
        requestRadicado: 'RAD-2026-IN-0109',
        responseRadicado: 'RAD-2026-OUT-0109',
        quotedTariffId: 'tariff-lon-luc',
        quotedAmountPesos: 3200000,
        createdById: auxiliar.id,
        reservations: {
          create: {
            id: 'res-demo-09',
            spaceId: 'space-sala-principal',
            startsAt: slot9.start,
            endsAt: slot9.end,
            status: ReservationStatus.CONFIRMED,
            createdById: auxiliar.id,
          },
        },
        requestDocuments: {
          create: buildDocs(CustomerType.LEGAL, true, auxiliar.id),
        },
        contract: {
          create: {
            id: 'contract-demo-09',
            number: 'ARR-2026-0001',
            object: 'Arrendamiento de la Sala Principal del Teatro Municipal Santiago Londoño para Concierto de Gala Aniversario',
            valuePesos: 3200000,
            additionalClauses: 'El arrendatario dispondrá de personal certificado de logística y acomodación.',
            signedAt: new Date(now.getTime() - 3600000 * 1),
            signedById: secretario.id,
            createdById: auxiliar.id,
          },
        },
        payment: {
          create: {
            id: 'payment-demo-09',
            receiptNumber: 'REC-2026-0083',
            bankName: 'Banco de Occidente',
            voucherNumber: 'VOUCH-12345',
            paidAt: new Date(now.getTime() - 3600000 * 6),
            amountPesos: 3200000,
            invoiceNumber: 'FE-2026-0083',
            invoiceDate: new Date(now.getTime() - 3600000 * 6),
            createdById: auxiliar.id,
          },
        },
        legalReviews: {
          create: {
            id: 'legal-review-demo-09',
            round: 1,
            reviewerId: juridica.id,
            documentsOk: true,
            customerDataOk: true,
            clausesOk: true,
            decision: LegalDecision.APPROVED,
            observations: 'Minuta y soportes aprobados sin observaciones.',
            reviewedAt: new Date(now.getTime() - 3600000 * 3),
          },
        },
        stateTransitions: {
          create: [
            {
              transition: 'register',
              fromStatus: null,
              toStatus: 'REGISTERED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 16),
            },
            {
              transition: 'respond',
              fromStatus: 'REGISTERED',
              toStatus: 'RESPONDED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 14),
            },
            {
              transition: 'verifyDocuments',
              fromStatus: 'RESPONDED',
              toStatus: 'DOCUMENTS_VERIFIED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 12),
            },
            {
              transition: 'draftContract',
              fromStatus: 'DOCUMENTS_VERIFIED',
              toStatus: 'CONTRACT_DRAFTED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 10),
            },
            {
              transition: 'registerPayment',
              fromStatus: 'CONTRACT_DRAFTED',
              toStatus: 'PAID',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 8),
            },
            {
              transition: 'submitToLegal',
              fromStatus: 'PAID',
              toStatus: 'LEGAL_REVIEW',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 6),
            },
            {
              transition: 'approveLegal',
              fromStatus: 'LEGAL_REVIEW',
              toStatus: 'PENDING_SIGNATURE',
              actorId: juridica.id,
              occurredAt: new Date(now.getTime() - 3600000 * 3),
            },
            {
              transition: 'signAndNumber',
              fromStatus: 'PENDING_SIGNATURE',
              toStatus: 'LEGALIZED',
              actorId: secretario.id,
              note: 'Contrato legalizado y radicado bajo el número ARR-2026-0001',
              occurredAt: new Date(now.getTime() - 3600000 * 1),
            },
          ],
        },
      },
    });

    // Actualizar consecutivo de contratos para 2026
    await tx.contractSequence.upsert({
      where: { year: 2026 },
      update: { lastValue: 1 },
      create: { year: 2026, lastValue: 1 },
    });

    // 12. Solicitud 10: CANCELLED
    // Solicitud cancelada con motivo y reserva liberada
    const slot10 = getSlot(12, 10, 2);
    await tx.rentalRequest.create({
      data: {
        id: 'rental-demo-10-cancelled',
        status: RentalStatus.CANCELLED,
        customerId: 'customer-demo-10',
        spaceId: 'space-auditorio-principal',
        eventName: 'Coloquio de Tradiciones Orales del Paisaje Cafetero',
        eventDescription: 'Encuentro narrativo de cronistas y cuenteros populares.',
        purpose: EventPurpose.NON_LUCRATIVE,
        expectedAttendees: 90,
        startsAt: slot10.start,
        endsAt: slot10.end,
        channel: RequestChannel.WRITTEN,
        requestRadicado: 'RAD-2026-IN-0110',
        cancelReason: 'Cancelado a solicitud expresa del organizador por imprevistos de fuerza mayor.',
        createdById: auxiliar.id,
        reservations: {
          create: {
            id: 'res-demo-10',
            spaceId: 'space-auditorio-principal',
            startsAt: slot10.start,
            endsAt: slot10.end,
            status: ReservationStatus.RELEASED,
            createdById: auxiliar.id,
          },
        },
        requestDocuments: {
          create: buildDocs(CustomerType.NATURAL, false),
        },
        stateTransitions: {
          create: [
            {
              transition: 'register',
              fromStatus: null,
              toStatus: 'REGISTERED',
              actorId: auxiliar.id,
              occurredAt: new Date(now.getTime() - 3600000 * 20),
            },
            {
              transition: 'cancel',
              fromStatus: 'REGISTERED',
              toStatus: 'CANCELLED',
              actorId: jefe.id,
              note: 'Cancelado a solicitud expresa del organizador por imprevistos de fuerza mayor.',
              occurredAt: new Date(now.getTime() - 3600000 * 18),
            },
          ],
        },
      },
    });
  });

  // 13. Generar snapshots imprimibles (oficios, estudios previos y contratos)
  const renderer = new DocumentRenderer(prismaClient);

  // Solicitudes 2 y 3: Oficio de respuesta
  await renderer.generateResponseLetter('rental-demo-02-responded', auxiliar.id);
  await renderer.generateResponseLetter('rental-demo-03-doc-verified', auxiliar.id);

  // Solicitudes 4 a 8: Oficio + Estudio Previo + Minuta
  for (const id of [
    'rental-demo-04-contract-drafted',
    'rental-demo-05-paid',
    'rental-demo-06-legal-review',
    'rental-demo-07-returned-by-legal',
    'rental-demo-08-pending-signature',
  ]) {
    await renderer.generateResponseLetter(id, auxiliar.id);
    await renderer.generatePriorStudyAndContract(id, undefined, auxiliar.id);
  }

  // Solicitud 9: Oficio + Estudio Previo + Minuta + Contrato Legalizado
  await renderer.generateResponseLetter('rental-demo-09-legalized', auxiliar.id);
  await renderer.generatePriorStudyAndContract('rental-demo-09-legalized', undefined, auxiliar.id);
  await renderer.generateFinalContract('rental-demo-09-legalized', secretario.id);
}

async function main() {
  console.info('🌱 Starting SGEC database seeding...');
  await seedUsers();
  await seedCatalog();
  await seedDocumentRequirements();
  await seedDemoRentals();
  console.info('✅ Database seeded successfully (users, catalog, tariffs, requirements, demo rentals in all 10 states).');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  main()
    .catch((e) => {
      console.error('❌ Seeding error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

