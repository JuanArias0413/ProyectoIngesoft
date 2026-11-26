import {
  InvalidTransitionError,
  ValidationError,
} from '../../../../shared/errors.js';
import {
  RentalStatus,
  TransitionName,
  UserRole,
  CanTransitionResult,
  ApproveLegalPayload,
  ReturnLegalPayload,
  CancelPayload,
} from './types.js';
import { RentalState, IRentalContext } from './rentalState.js';
import { stateFor } from './stateFactory.js';

export class LegalReviewState implements RentalState {
  public readonly status: RentalStatus = 'LEGAL_REVIEW';
  public readonly label = 'En revisión jurídica';

  public allowedTransitions(): TransitionName[] {
    return ['approveLegal', 'returnLegal', 'cancel'];
  }

  public can(transition: TransitionName, actorRole: UserRole): CanTransitionResult {
    if (!this.allowedTransitions().includes(transition)) {
      return {
        allowed: false,
        reason: `La transición '${transition}' no está permitida desde el estado 'En revisión jurídica'`,
      };
    }

    if (transition === 'approveLegal' || transition === 'returnLegal') {
      if (actorRole === 'LEGAL') return { allowed: true };
      return {
        allowed: false,
        reason: `El rol '${actorRole}' no está autorizado para resolver revisiones jurídicas (solo la Oficina Jurídica)`,
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
    if (transition === 'approveLegal') {
      const p = (payload ?? {}) as Partial<ApproveLegalPayload>;
      if (!p.documentsOk || !p.customerDataOk || !p.clausesOk) {
        throw new ValidationError(
          'Deben marcarse las tres verificaciones obligatorias: documentación, datos del arrendatario y cláusulas normativas (CAR-07)',
        );
      }
      return stateFor('PENDING_SIGNATURE');
    }

    if (transition === 'returnLegal') {
      const p = (payload ?? {}) as Partial<ReturnLegalPayload>;
      if (!p.observations || typeof p.observations !== 'string' || p.observations.trim().length < 10) {
        throw new ValidationError(
          'Las observaciones de devolución deben tener al menos 10 caracteres explicativos',
        );
      }
      return stateFor('RETURNED_BY_LEGAL');
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
