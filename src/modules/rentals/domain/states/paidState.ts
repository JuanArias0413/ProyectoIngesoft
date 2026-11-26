import {
  InvalidTransitionError,
  ValidationError,
} from '../../../../shared/errors.js';
import {
  RentalStatus,
  TransitionName,
  UserRole,
  CanTransitionResult,
  CancelPayload,
} from './types.js';
import { RentalState, IRentalContext } from './rentalState.js';
import { stateFor } from './stateFactory.js';

export class PaidState implements RentalState {
  public readonly status: RentalStatus = 'PAID';
  public readonly label = 'Pagado';

  public allowedTransitions(): TransitionName[] {
    return ['submitToLegal', 'cancel'];
  }

  public can(transition: TransitionName, actorRole: UserRole): CanTransitionResult {
    if (!this.allowedTransitions().includes(transition)) {
      return {
        allowed: false,
        reason: `La transición '${transition}' no está permitida desde el estado 'Pagado'`,
      };
    }

    if (transition === 'submitToLegal') {
      if (actorRole === 'ADMIN_ASSISTANT') return { allowed: true };
      return {
        allowed: false,
        reason: `El rol '${actorRole}' no está autorizado para enviar solicitudes a revisión jurídica`,
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
    if (transition === 'submitToLegal') {
      return stateFor('LEGAL_REVIEW');
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
