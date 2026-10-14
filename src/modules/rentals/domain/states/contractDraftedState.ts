import {
  InvalidTransitionError,
  ValidationError,
} from '../../../../shared/errors.js';
import {
  RentalStatus,
  TransitionName,
  UserRole,
  CanTransitionResult,
  RegisterPaymentPayload,
  CancelPayload,
} from './types.js';
import { RentalState, IRentalContext } from './rentalState.js';
import { stateFor } from './stateFactory.js';

export class ContractDraftedState implements RentalState {
  public readonly status: RentalStatus = 'CONTRACT_DRAFTED';
  public readonly label = 'Contrato elaborado';

  public allowedTransitions(): TransitionName[] {
    return ['registerPayment', 'cancel'];
  }

  public can(transition: TransitionName, actorRole: UserRole): CanTransitionResult {
    if (!this.allowedTransitions().includes(transition)) {
      return {
        allowed: false,
        reason: `La transición '${transition}' no está permitida desde el estado 'Contrato elaborado'`,
      };
    }

    if (transition === 'registerPayment') {
      if (actorRole === 'ADMIN_ASSISTANT') return { allowed: true };
      return {
        allowed: false,
        reason: `El rol '${actorRole}' no está autorizado para registrar pagos`,
      };
    }

    if (transition === 'cancel') {
      if (actorRole === 'ADMIN_ASSISTANT' || actorRole === 'OFFICE_HEAD') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `El rol '${actorRole}' no está autorizado para cancelar solicitudes`,
      };
    }

    return { allowed: false, reason: 'Acción no permitida' };
  }

  public apply(
    context: IRentalContext,
    transition: TransitionName,
    payload?: unknown,
  ): RentalState {
    if (transition === 'registerPayment') {
      const p = (payload ?? {}) as Partial<RegisterPaymentPayload>;

      if (!p.receiptNumber || typeof p.receiptNumber !== 'string' || !p.receiptNumber.trim()) {
        throw new ValidationError('El número de recibo es obligatorio');
      }
      if (!p.bankName || typeof p.bankName !== 'string' || !p.bankName.trim()) {
        throw new ValidationError('El nombre del banco es obligatorio');
      }
      if (!p.voucherNumber || typeof p.voucherNumber !== 'string' || !p.voucherNumber.trim()) {
        throw new ValidationError('El número de comprobante de consignación es obligatorio');
      }
      if (!p.invoiceNumber || typeof p.invoiceNumber !== 'string' || !p.invoiceNumber.trim()) {
        throw new ValidationError('El número de factura es obligatorio');
      }

      if (typeof p.amountPesos !== 'number' || p.amountPesos <= 0) {
        throw new ValidationError('El monto pagado debe ser mayor a cero');
      }

      if (
        context.quotedAmountPesos !== null &&
        p.amountPesos !== context.quotedAmountPesos
      ) {
        throw new ValidationError(
          `El monto pagado ($${p.amountPesos.toLocaleString('es-CO')}) debe coincidir exactamente con el valor cotizado ($${context.quotedAmountPesos.toLocaleString('es-CO')}) (regla A-08)`,
        );
      }

      return stateFor('PAID');
    }

    if (transition === 'cancel') {
      const p = (payload ?? {}) as Partial<CancelPayload>;
      if (!p.reason || typeof p.reason !== 'string' || p.reason.trim().length < 10) {
        throw new ValidationError(
          'El motivo de cancelación debe tener al menos 10 caracteres',
        );
      }
      context.cancelReason = p.reason.trim();
      return stateFor('CANCELLED');
    }

    throw new InvalidTransitionError(this.status, transition);
  }
}
