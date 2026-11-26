import type { PrismaClient, RentalRequest, Payment } from '@prisma/client';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { NotFoundError } from '../../../shared/errors.js';
import { RentalContext } from '../domain/states/rentalContext.js';
import type { UserRole as DomainUserRole } from '../domain/states/types.js';

export interface RegisterPaymentInput {
  rentalRequestId: string;
  receiptNumber: string;
  bankName: string;
  voucherNumber: string;
  paidAt?: Date;
  amountPesos: number;
  invoiceNumber: string;
  invoiceDate: Date;
  voucherFileKey?: string | null;
  actorId: string;
  actorRole: PrismaUserRole;
}

export interface RegisterPaymentResult {
  rentalRequest: RentalRequest;
  payment: Payment;
}

export class RegisterPaymentUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  public async execute(input: RegisterPaymentInput): Promise<RegisterPaymentResult> {
    const {
      rentalRequestId,
      receiptNumber,
      bankName,
      voucherNumber,
      paidAt,
      amountPesos,
      invoiceNumber,
      invoiceDate,
      voucherFileKey,
      actorId,
      actorRole,
    } = input;

    // 1. Obtener la solicitud
    const rental = await this.prisma.rentalRequest.findUnique({
      where: { id: rentalRequestId },
      include: {
        contract: true,
      },
    });

    if (!rental) {
      throw new NotFoundError(`Solicitud con ID ${rentalRequestId} no encontrada`);
    }

    // 2. Transición y validaciones de negocio en máquina de estados
    const context = new RentalContext({
      id: rental.id,
      status: rental.status,
      customerId: rental.customerId,
      spaceId: rental.spaceId,
      eventName: rental.eventName,
      eventDescription: rental.eventDescription,
      purpose: rental.purpose,
      expectedAttendees: rental.expectedAttendees,
      startsAt: rental.startsAt,
      endsAt: rental.endsAt,
      channel: rental.channel,
      requestRadicado: rental.requestRadicado,
      responseRadicado: rental.responseRadicado,
      quotedAmountPesos: rental.quotedAmountPesos,
      quotedTariffId: rental.quotedTariffId,
      cancelReason: rental.cancelReason,
    });

    const paymentDate = paidAt ?? new Date();

    const transitionRecord = context.transition(
      'registerPayment',
      actorRole as unknown as DomainUserRole,
      {
        receiptNumber: receiptNumber.trim(),
        bankName: bankName.trim(),
        voucherNumber: voucherNumber.trim(),
        paidAt: paymentDate,
        amountPesos,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        voucherFileKey: voucherFileKey || undefined,
      },
      actorId,
    );

    // 3. Persistir atómicamente el pago, cambio de estado a PAID y la transición
    const { updatedRental, payment } = await this.prisma.$transaction(async (tx) => {
      const savedPayment = await tx.payment.upsert({
        where: { rentalRequestId: rental.id },
        create: {
          rentalRequestId: rental.id,
          receiptNumber: receiptNumber.trim(),
          bankName: bankName.trim(),
          voucherNumber: voucherNumber.trim(),
          paidAt: paymentDate,
          amountPesos,
          invoiceNumber: invoiceNumber.trim(),
          invoiceDate,
          voucherFileKey: voucherFileKey || null,
          createdById: actorId,
          updatedById: actorId,
        },
        update: {
          receiptNumber: receiptNumber.trim(),
          bankName: bankName.trim(),
          voucherNumber: voucherNumber.trim(),
          paidAt: paymentDate,
          amountPesos,
          invoiceNumber: invoiceNumber.trim(),
          invoiceDate,
          voucherFileKey: voucherFileKey || null,
          updatedById: actorId,
        },
      });

      const updated = await tx.rentalRequest.update({
        where: { id: rental.id },
        data: {
          status: 'PAID',
          updatedById: actorId,
        },
      });

      await tx.stateTransition.create({
        data: {
          rentalRequestId: rental.id,
          fromStatus: transitionRecord.fromStatus,
          toStatus: transitionRecord.toStatus,
          transition: transitionRecord.transition,
          actorId,
          note:
            transitionRecord.note ??
            `Pago registrado por $${amountPesos.toLocaleString('es-CO')} COP (Recibo: ${receiptNumber.trim()}, Factura: ${invoiceNumber.trim()})`,
          occurredAt: transitionRecord.occurredAt,
        },
      });

      return { updatedRental: updated, payment: savedPayment };
    });

    return {
      rentalRequest: updatedRental,
      payment,
    };
  }
}
