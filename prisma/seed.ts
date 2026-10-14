import {
  UserRole,
  PricingUnit,
  EventPurpose,
  CustomerType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/infra/prisma.js';

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

async function main() {
  console.info('🌱 Starting SGEC database seeding...');
  await seedUsers();
  await seedCatalog();
  await seedDocumentRequirements();
  console.info('✅ Database seeded successfully (users, catalog, tariffs, requirements).');
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
