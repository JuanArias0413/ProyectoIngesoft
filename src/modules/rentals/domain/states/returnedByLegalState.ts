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

export class ReturnedByLegalState implements RentalState {
  public readonly status: RentalStatus = 'RETURNED_BY_LEGAL';
  public readonly label = 'Devuelto por Jurídica';

  public allowedTransitions(): TransitionName[] {
    return ['resubmitToLegal', 'cancel'];
  }

  public can(transition: TransitionName, actorRole: UserRole): CanTransitionResult {
    if (!this.allowedTransitions().includes(transition)) {
      return {
        allowed: false,
        reason: `La transición '${transition}' no está permitida desde el estado 'Devuelto por Jurídica'`,
      };
    }

    if (transition === 'resubmitToLegal') {
      if (actorRole === 'ADMIN_ASSISTANT') return { allowed: true };
      return {
        allowed: false,
        reason: `El rol '${actorRole}' no está autorizado para reenviar solicitudes a Jurídica`,
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
    if (transition === 'resubmitToLegal') {
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
