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

export class PendingSignatureState implements RentalState {
  public readonly status: RentalStatus = 'PENDING_SIGNATURE';
  public readonly label = 'Pendiente de firma';

  public allowedTransitions(): TransitionName[] {
    return ['signAndNumber', 'cancel'];
  }

  public can(transition: TransitionName, actorRole: UserRole): CanTransitionResult {
    if (!this.allowedTransitions().includes(transition)) {
      return {
        allowed: false,
        reason: `La transición '${transition}' no está permitida desde el estado 'Pendiente de firma'`,
      };
    }

    if (transition === 'signAndNumber') {
      if (actorRole === 'SECRETARY') return { allowed: true };
      return {
        allowed: false,
        reason: `El rol '${actorRole}' no está autorizado para firmar y numerar contratos (solo el Secretario de Cultura)`,
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
    if (transition === 'signAndNumber') {
      return stateFor('LEGALIZED');
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
