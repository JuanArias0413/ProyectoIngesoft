import {
  RentalStatus,
  ReservationStatus,
  CustomerType,
  EventPurpose,
  RequestChannel,
  UserRole,
  DocumentKind,
  LegalDecision,
  type User,
  type Space,
  type Tariff,
  type Customer,
  type RentalRequest,
  type Reservation,
  type Contract,
  type Payment,
  type LegalReview,
  type GeneratedDocument,
  type StateTransition,
} from '@prisma/client';
import crypto from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { expect } from 'vitest';
import { prisma } from '../../src/infra/prisma.js';
import { createUser, createVenue, createSpace, createTariff, createCustomer } from './factories.js';
import { loginAs } from './auth.js';

export interface CreateRentalInStateOptions {
  customerId?: string;
  customerType?: CustomerType;
  spaceId?: string;
  tariffPricePesos?: number;
  startsAt?: Date;
  endsAt?: Date;
  purpose?: EventPurpose;
  channel?: RequestChannel;
  eventName?: string;
  eventDescription?: string;
  cancelReason?: string;
  requestRadicado?: string | null;
  assistantUser?: User;
  legalUser?: User;
  secretaryUser?: User;
  headUser?: User;
}

export interface RentalInStateResult {
  rental: RentalRequest;
  customer: Customer;
  space: Space;
  tariff: Tariff;
  reservation: Reservation;
  contract?: Contract | null;
  payment?: Payment | null;
  legalReview?: LegalReview | null;
  generatedDocs: GeneratedDocument[];
  transitions: StateTransition[];
  users: {
    assistant: User;
    legal: User;
    secretary: User;
    head: User;
  };
}

export function assertForbidden(res: { status: number; text?: string; body?: unknown }): void {
  expect(res.status).toBe(403);
}

export async function uploadTestFile(
  app: Express,
  solicitudId: string,
  reqCode: string,
  buffer: Buffer = Buffer.from('%PDF-1.4 test document content'),
  mimeType: string = 'application/pdf',
  filename: string = 'soporte.pdf',
  agent?: ReturnType<typeof request.agent>,
) {
  const reqAgent = agent ?? (await loginAs(app, UserRole.ADMIN_ASSISTANT)).agent;

  // Retrieve CSRF token
  const page = await reqAgent.get(`/solicitudes/${solicitudId}`);
  const match = page.text.match(/name="_csrf" value="([^"]+)"/);
  const csrfToken = match ? match[1] : '';

  return reqAgent
    .post(`/solicitudes/${solicitudId}/documentos/${reqCode}/archivo`)
    .field('_csrf', csrfToken)
    .attach('file', buffer, { filename, contentType: mimeType });
}

let helperDayOffset = 100;

export async function createRentalInState(
  targetState: RentalStatus,
  opts: CreateRentalInStateOptions = {},
): Promise<RentalInStateResult> {
  // Ensure users
  const assistant = opts.assistantUser ?? (await createUser(UserRole.ADMIN_ASSISTANT));
  const legal = opts.legalUser ?? (await createUser(UserRole.LEGAL));
  const secretary = opts.secretaryUser ?? (await createUser(UserRole.SECRETARY));
  const head = opts.headUser ?? (await createUser(UserRole.OFFICE_HEAD));

  // Ensure venue, space, tariff
  let space: Space;
  if (opts.spaceId) {
    const found = await prisma.space.findUnique({ where: { id: opts.spaceId } });
    if (!found) throw new Error(`Space with id ${opts.spaceId} not found`);
    space = found;
  } else {
    const venue = await createVenue();
    space = await createSpace(venue.id);
  }

  const existingTariff = await prisma.tariff.findFirst({
    where: { spaceId: space.id, purpose: opts.purpose ?? EventPurpose.LUCRATIVE },
  });

  const tariff =
    existingTariff ??
    (await createTariff(space.id, {
      pricePesos: opts.tariffPricePesos ?? 450000,
      purpose: opts.purpose ?? EventPurpose.LUCRATIVE,
      unit: space.pricingUnit,
    }));

  // Ensure customer
  const customerType = opts.customerType ?? CustomerType.NATURAL;
  let customer: Customer;
  if (opts.customerId) {
    const found = await prisma.customer.findUnique({ where: { id: opts.customerId } });
    if (!found) throw new Error(`Customer with id ${opts.customerId} not found`);
    customer = found;
  } else {
    customer = await createCustomer({ type: customerType });
  }

  helperDayOffset += 5;
  const startsAt = opts.startsAt ?? new Date(Date.now() + helperDayOffset * 24 * 60 * 60 * 1000);
  const endsAt = opts.endsAt ?? new Date(startsAt.getTime() + 4 * 60 * 60 * 1000);
  const rentalId = crypto.randomUUID();

  // 1. REGISTERED State
  let rental = await prisma.rentalRequest.create({
    data: {
      id: rentalId,
      customerId: customer.id,
      spaceId: space.id,
      eventName: opts.eventName ?? `Evento ${rentalId.slice(0, 6)}`,
      eventDescription: opts.eventDescription ?? 'Descripción del evento cultural',
      purpose: opts.purpose ?? EventPurpose.LUCRATIVE,
      expectedAttendees: 150,
      startsAt,
      endsAt,
      channel: opts.channel ?? RequestChannel.WRITTEN,
      status: RentalStatus.REGISTERED,
      requestRadicado: opts.requestRadicado !== undefined ? opts.requestRadicado : 'RAD-SOL-2026-001',
      createdById: assistant.id,
    },
  });

  const initialResStatus =
    targetState === RentalStatus.CANCELLED
      ? ReservationStatus.RELEASED
      : targetState === RentalStatus.LEGALIZED
      ? ReservationStatus.CONFIRMED
      : ReservationStatus.HELD;

  let reservation = await prisma.reservation.create({
    data: {
      spaceId: space.id,
      rentalRequestId: rental.id,
      startsAt,
      endsAt,
      status: initialResStatus,
      createdById: assistant.id,
    },
  });

  // Seed checklist according to customer type (A-09)
  const reqCodes =
    customerType === CustomerType.NATURAL
      ? ['CC', 'RUT', 'EVENT_DESC']
      : ['CERT_EXISTENCE', 'RUT', 'REP_DOC', 'EVENT_DESC'];

  for (const code of reqCodes) {
    await prisma.requestDocument.create({
      data: {
        rentalRequestId: rental.id,
        requirementCode: code,
        createdById: assistant.id,
      },
    });
  }

  await prisma.stateTransition.create({
    data: {
      rentalRequestId: rental.id,
      fromStatus: null,
      toStatus: RentalStatus.REGISTERED,
      transition: 'register',
      actorId: assistant.id,
      note: 'Solicitud registrada en el sistema',
    },
  });

  if (targetState === RentalStatus.REGISTERED) {
    return assembleResult();
  }

  // 2. RESPONDED State
  const hours = Math.ceil((endsAt.getTime() - startsAt.getTime()) / (60 * 60 * 1000));
  const quotedAmountPesos = tariff.pricePesos * Math.max(1, hours);

  rental = await prisma.rentalRequest.update({
    where: { id: rental.id },
    data: {
      status: RentalStatus.RESPONDED,
      responseRadicado: 'RAD-RESP-2026-001',
      quotedAmountPesos,
      quotedTariffId: tariff.id,
      updatedById: assistant.id,
    },
  });

  await prisma.generatedDocument.create({
    data: {
      rentalRequestId: rental.id,
      kind: DocumentKind.RESPONSE_LETTER,
      version: 1,
      html: `<html><body><h1>Oficio de Respuesta RAD-RESP-2026-001</h1><p>Valor: $${quotedAmountPesos}</p></body></html>`,
      generatedById: assistant.id,
    },
  });

  await prisma.stateTransition.create({
    data: {
      rentalRequestId: rental.id,
      fromStatus: RentalStatus.REGISTERED,
      toStatus: RentalStatus.RESPONDED,
      transition: 'respond',
      actorId: assistant.id,
      note: 'Oficio de respuesta generado',
    },
  });

  if (targetState === RentalStatus.RESPONDED) {
    return assembleResult();
  }

  // 3. DOCUMENTS_VERIFIED State
  await prisma.requestDocument.updateMany({
    where: { rentalRequestId: rental.id },
    data: {
      receivedAt: new Date(),
      verifiedAt: new Date(),
      verifiedById: assistant.id,
      notes: 'Documento verificado conforme',
    },
  });

  rental = await prisma.rentalRequest.update({
    where: { id: rental.id },
    data: {
      status: RentalStatus.DOCUMENTS_VERIFIED,
      updatedById: assistant.id,
    },
  });

  await prisma.stateTransition.create({
    data: {
      rentalRequestId: rental.id,
      fromStatus: RentalStatus.RESPONDED,
      toStatus: RentalStatus.DOCUMENTS_VERIFIED,
      transition: 'verifyDocuments',
      actorId: assistant.id,
      note: 'Todos los documentos obligatorios verificados',
    },
  });

  if (targetState === RentalStatus.DOCUMENTS_VERIFIED) {
    return assembleResult();
  }

  // 4. CONTRACT_DRAFTED State
  let contract = await prisma.contract.create({
    data: {
      rentalRequestId: rental.id,
      object: `Arrendamiento de ${space.name} para ${rental.eventName}`,
      valuePesos: quotedAmountPesos,
      additionalClauses: 'El arrendatario se compromete al cuidado de los bienes culturales.',
      createdById: assistant.id,
    },
  });

  await prisma.generatedDocument.create({
    data: {
      rentalRequestId: rental.id,
      kind: DocumentKind.PRIOR_STUDY,
      version: 1,
      html: '<html><body><h1>Estudio Previo v1</h1></body></html>',
      generatedById: assistant.id,
    },
  });

  await prisma.generatedDocument.create({
    data: {
      rentalRequestId: rental.id,
      kind: DocumentKind.CONTRACT,
      version: 1,
      html: '<html><body><h1>Borrador de Contrato v1</h1></body></html>',
      generatedById: assistant.id,
    },
  });

  rental = await prisma.rentalRequest.update({
    where: { id: rental.id },
    data: {
      status: RentalStatus.CONTRACT_DRAFTED,
      updatedById: assistant.id,
    },
  });

  await prisma.stateTransition.create({
    data: {
      rentalRequestId: rental.id,
      fromStatus: RentalStatus.DOCUMENTS_VERIFIED,
      toStatus: RentalStatus.CONTRACT_DRAFTED,
      transition: 'draftContract',
      actorId: assistant.id,
      note: 'Estudio previo y borrador de contrato elaborados',
    },
  });

  if (targetState === RentalStatus.CONTRACT_DRAFTED) {
    return assembleResult(contract);
  }

  // 5. PAID State
  const payment = await prisma.payment.create({
    data: {
      rentalRequestId: rental.id,
      receiptNumber: `REC-${rental.id.slice(0, 8)}`,
      bankName: 'Banco de Occidente',
      voucherNumber: `VOUCH-${rental.id.slice(0, 6)}`,
      paidAt: new Date(),
      amountPesos: quotedAmountPesos,
      invoiceNumber: `FAC-${rental.id.slice(0, 6)}`,
      invoiceDate: new Date(),
      createdById: assistant.id,
    },
  });

  rental = await prisma.rentalRequest.update({
    where: { id: rental.id },
    data: {
      status: RentalStatus.PAID,
      updatedById: assistant.id,
    },
  });

  await prisma.stateTransition.create({
    data: {
      rentalRequestId: rental.id,
      fromStatus: RentalStatus.CONTRACT_DRAFTED,
      toStatus: RentalStatus.PAID,
      transition: 'registerPayment',
      actorId: assistant.id,
      note: 'Pago y facturación registrados',
    },
  });

  if (targetState === RentalStatus.PAID) {
    return assembleResult(contract, payment);
  }

  // 6. LEGAL_REVIEW State
  rental = await prisma.rentalRequest.update({
    where: { id: rental.id },
    data: {
      status: RentalStatus.LEGAL_REVIEW,
      updatedById: assistant.id,
    },
  });

  await prisma.stateTransition.create({
    data: {
      rentalRequestId: rental.id,
      fromStatus: RentalStatus.PAID,
      toStatus: RentalStatus.LEGAL_REVIEW,
      transition: 'submitToLegal',
      actorId: assistant.id,
      note: 'Expediente remitido a Oficina Jurídica',
    },
  });

  if (targetState === RentalStatus.LEGAL_REVIEW) {
    return assembleResult(contract, payment);
  }

  // 7. RETURNED_BY_LEGAL State
  if (targetState === RentalStatus.RETURNED_BY_LEGAL) {
    const legalReview = await prisma.legalReview.create({
      data: {
        rentalRequestId: rental.id,
        round: 1,
        reviewerId: legal.id,
        documentsOk: false,
        customerDataOk: true,
        clausesOk: false,
        decision: LegalDecision.RETURNED,
        observations: 'Ajustar la cláusula sexta referente a pólizas de responsabilidad civil.',
      },
    });

    rental = await prisma.rentalRequest.update({
      where: { id: rental.id },
      data: {
        status: RentalStatus.RETURNED_BY_LEGAL,
        updatedById: legal.id,
      },
    });

    await prisma.stateTransition.create({
      data: {
        rentalRequestId: rental.id,
        fromStatus: RentalStatus.LEGAL_REVIEW,
        toStatus: RentalStatus.RETURNED_BY_LEGAL,
        transition: 'returnLegal',
        actorId: legal.id,
        note: 'Devuelto con observaciones',
      },
    });

    return assembleResult(contract, payment, legalReview);
  }

  // 8. PENDING_SIGNATURE State
  const approvedReview = await prisma.legalReview.create({
    data: {
      rentalRequestId: rental.id,
      round: 1,
      reviewerId: legal.id,
      documentsOk: true,
      customerDataOk: true,
      clausesOk: true,
      decision: LegalDecision.APPROVED,
      observations: 'Revisión jurídica aprobada en su totalidad.',
    },
  });

  rental = await prisma.rentalRequest.update({
    where: { id: rental.id },
    data: {
      status: RentalStatus.PENDING_SIGNATURE,
      updatedById: legal.id,
    },
  });

  await prisma.stateTransition.create({
    data: {
      rentalRequestId: rental.id,
      fromStatus: RentalStatus.LEGAL_REVIEW,
      toStatus: RentalStatus.PENDING_SIGNATURE,
      transition: 'approveLegal',
      actorId: legal.id,
      note: 'Revisión jurídica aprobada',
    },
  });

  if (targetState === RentalStatus.PENDING_SIGNATURE) {
    return assembleResult(contract, payment, approvedReview);
  }

  // 9. LEGALIZED State
  if (targetState === RentalStatus.LEGALIZED) {
    const currentYear = new Date().getFullYear();
    const seq = await prisma.contractSequence.upsert({
      where: { year: currentYear },
      update: { lastValue: { increment: 1 } },
      create: { year: currentYear, lastValue: 1 },
    });

    const contractNumber = `ARR-${currentYear}-${seq.lastValue.toString().padStart(4, '0')}`;

    contract = await prisma.contract.update({
      where: { rentalRequestId: rental.id },
      data: {
        number: contractNumber,
        signedAt: new Date(),
        signedById: secretary.id,
        updatedById: secretary.id,
      },
    });

    reservation = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.CONFIRMED,
        updatedById: secretary.id,
      },
    });

    await prisma.generatedDocument.create({
      data: {
        rentalRequestId: rental.id,
        kind: DocumentKind.CONTRACT,
        version: 2,
        html: `<html><body><h1>Contrato Legalizado ${contractNumber}</h1></body></html>`,
        generatedById: secretary.id,
      },
    });

    rental = await prisma.rentalRequest.update({
      where: { id: rental.id },
      data: {
        status: RentalStatus.LEGALIZED,
        updatedById: secretary.id,
      },
    });

    await prisma.stateTransition.create({
      data: {
        rentalRequestId: rental.id,
        fromStatus: RentalStatus.PENDING_SIGNATURE,
        toStatus: RentalStatus.LEGALIZED,
        transition: 'signAndNumber',
        actorId: secretary.id,
        note: `Contrato firmado y numerado como ${contractNumber}`,
      },
    });

    return assembleResult(contract, payment, approvedReview);
  }

  // 10. CANCELLED State
  if (targetState === RentalStatus.CANCELLED) {
    reservation = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.RELEASED,
        updatedById: assistant.id,
      },
    });

    rental = await prisma.rentalRequest.update({
      where: { id: rental.id },
      data: {
        status: RentalStatus.CANCELLED,
        cancelReason: opts.cancelReason ?? 'Cancelación voluntaria por fuerza mayor',
        updatedById: assistant.id,
      },
    });

    await prisma.stateTransition.create({
      data: {
        rentalRequestId: rental.id,
        fromStatus: rental.status,
        toStatus: RentalStatus.CANCELLED,
        transition: 'cancel',
        actorId: assistant.id,
        note: opts.cancelReason ?? 'Cancelación voluntaria por fuerza mayor',
      },
    });

    return assembleResult(contract, payment);
  }

  return assembleResult();

  async function assembleResult(
    c?: Contract | null,
    p?: Payment | null,
    lr?: LegalReview | null,
  ): Promise<RentalInStateResult> {
    const generatedDocs = await prisma.generatedDocument.findMany({
      where: { rentalRequestId: rental.id },
      orderBy: { version: 'asc' },
    });

    const transitions = await prisma.stateTransition.findMany({
      where: { rentalRequestId: rental.id },
      orderBy: { occurredAt: 'asc' },
    });

    return {
      rental,
      customer,
      space,
      tariff,
      reservation,
      contract: c ?? null,
      payment: p ?? null,
      legalReview: lr ?? null,
      generatedDocs,
      transitions,
      users: {
        assistant,
        legal,
        secretary,
        head,
      },
    };
  }
}
