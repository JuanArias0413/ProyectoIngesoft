import { InvalidTransitionError } from '../../../../shared/errors.js';
import {
  RentalStatus,
  TransitionName,
  UserRole,
  CanTransitionResult,
} from './types.js';
import { RentalState, IRentalContext } from './rentalState.js';

export class LegalizedState implements RentalState {
  public readonly status: RentalStatus = 'LEGALIZED';
  public readonly label = 'Legalizado';

  public allowedTransitions(): TransitionName[] {
    return [];
  }

  public can(transition: TransitionName, _actorRole: UserRole): CanTransitionResult {
    return {
      allowed: false,
      reason: `El estado 'Legalizado' es un estado final terminal y no admite transiciones (intento: '${transition}')`,
    };
  }

  public apply(
    _context: IRentalContext,
    transition: TransitionName,
    _payload?: unknown,
  ): RentalState {
    throw new InvalidTransitionError(
      this.status,
      transition,
      `No se puede ejecutar la transición '${transition}' porque la solicitud ya se encuentra legalizada`,
    );
  }
}
