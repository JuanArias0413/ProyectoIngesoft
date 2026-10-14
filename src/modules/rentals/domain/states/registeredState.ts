import {
  InvalidTransitionError,
  ValidationError,
} from '../../../../shared/errors.js';
import {
  RentalStatus,
  TransitionName,
  UserRole,
  CanTransitionResult,
  RespondPayload,
  CancelPayload,
} from './types.js';
import { RentalState, IRentalContext } from './rentalState.js';
import { stateFor } from './stateFactory.js';

export class RegisteredState implements RentalState {
  public readonly status: RentalStatus = 'REGISTERED';
  public readonly label = 'Registrada';

  public allowedTransitions(): TransitionName[] {
    return ['respond', 'cancel'];
  }

  public can(transition: TransitionName, actorRole: UserRole): CanTransitionResult {
    if (!this.allowedTransitions().includes(transition)) {
      return {
        allowed: false,
        reason: `La transición '${transition}' no está permitida desde el estado 'Registrada'`,
      };
    }

    if (transition === 'respond') {
      if (actorRole === 'ADMIN_ASSISTANT') return { allowed: true };
      return {
        allowed: false,
        reason: `El rol '${actorRole}' no está autorizado para responder solicitudes`,
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
    if (transition === 'respond') {
      const p = (payload ?? {}) as Partial<RespondPayload>;
      if (!p.responseRadicado || typeof p.responseRadicado !== 'string' || !p.responseRadicado.trim()) {
        throw new ValidationError(
          'El número de radicado del oficio de respuesta es obligatorio (regla A-02)',
        );
      }
      if (typeof p.quotedAmountPesos !== 'number' || p.quotedAmountPesos <= 0) {
        throw new ValidationError('El valor cotizado debe ser mayor a cero');
      }
      if (!p.quotedTariffId || typeof p.quotedTariffId !== 'string') {
        throw new ValidationError('Debe indicarse la tarifa vigente aplicada');
      }

      context.responseRadicado = p.responseRadicado.trim();
      context.quotedAmountPesos = p.quotedAmountPesos;
      context.quotedTariffId = p.quotedTariffId;

      return stateFor('RESPONDED');
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
