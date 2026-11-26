import {
  RentalStatus,
  TransitionName,
  UserRole,
  CanTransitionResult,
} from './types.js';

export interface IRentalContext {
  readonly id: string;
  status: RentalStatus;
  responseRadicado: string | null;
  quotedAmountPesos: number | null;
  quotedTariffId: string | null;
  cancelReason: string | null;
}

export interface RentalState {
  readonly status: RentalStatus;
  readonly label: string;
  allowedTransitions(): TransitionName[];
  can(transition: TransitionName, actorRole: UserRole): CanTransitionResult;
  apply(context: IRentalContext, transition: TransitionName, payload?: unknown): RentalState;
}
