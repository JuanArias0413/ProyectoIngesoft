import {
  InvalidTransitionError,
  ForbiddenError,
} from '../../../../shared/errors.js';
import {
  RentalStatus,
  TransitionName,
  UserRole,
  CanTransitionResult,
  StateTransitionRecord,
  ReturnLegalPayload,
} from './types.js';
import { RentalState, IRentalContext } from './rentalState.js';
import { stateFor } from './stateFactory.js';

export interface CreateRentalContextInput {
  id: string;
  status?: RentalStatus;
  customerId: string;
  spaceId: string;
  eventName: string;
  eventDescription: string;
  purpose: string;
  expectedAttendees: number;
  startsAt: Date;
  endsAt: Date;
  channel: string;
  requestRadicado?: string | null;
  responseRadicado?: string | null;
  quotedAmountPesos?: number | null;
  quotedTariffId?: string | null;
  cancelReason?: string | null;
  transitions?: StateTransitionRecord[];
}

export class RentalContext implements IRentalContext {
  public readonly id: string;
  public status: RentalStatus;
  public currentState: RentalState;

  public readonly customerId: string;
  public readonly spaceId: string;
  public readonly eventName: string;
  public readonly eventDescription: string;
  public readonly purpose: string;
  public readonly expectedAttendees: number;
  public readonly startsAt: Date;
  public readonly endsAt: Date;
  public readonly channel: string;
  public readonly requestRadicado: string | null;

  public responseRadicado: string | null;
  public quotedAmountPesos: number | null;
  public quotedTariffId: string | null;
  public cancelReason: string | null;

  public readonly transitions: StateTransitionRecord[];

  constructor(input: CreateRentalContextInput) {
    this.id = input.id;
    this.status = input.status ?? 'REGISTERED';
    this.currentState = stateFor(this.status);

    this.customerId = input.customerId;
    this.spaceId = input.spaceId;
    this.eventName = input.eventName;
    this.eventDescription = input.eventDescription;
    this.purpose = input.purpose;
    this.expectedAttendees = input.expectedAttendees;
    this.startsAt = input.startsAt;
    this.endsAt = input.endsAt;
    this.channel = input.channel;
    this.requestRadicado = input.requestRadicado ?? null;

    this.responseRadicado = input.responseRadicado ?? null;
    this.quotedAmountPesos = input.quotedAmountPesos ?? null;
    this.quotedTariffId = input.quotedTariffId ?? null;
    this.cancelReason = input.cancelReason ?? null;

    this.transitions = input.transitions ? [...input.transitions] : [];
  }

  public can(transition: TransitionName, actorRole: UserRole): CanTransitionResult {
    return this.currentState.can(transition, actorRole);
  }

  public transition(
    transition: TransitionName,
    actorRole: UserRole,
    payload?: unknown,
    actorId = 'system',
  ): StateTransitionRecord {
    const check = this.currentState.can(transition, actorRole);
    if (!check.allowed) {
      const isTransitionSupported = this.currentState
        .allowedTransitions()
        .includes(transition);

      if (!isTransitionSupported) {
        throw new InvalidTransitionError(
          this.status,
          transition,
          check.reason,
        );
      }

      throw new ForbiddenError(
        check.reason ??
          `El rol '${actorRole}' no tiene permiso para ejecutar la transición '${transition}'`,
      );
    }

    const fromStatus = this.status;
    const nextState = this.currentState.apply(this, transition, payload);

    this.status = nextState.status;
    this.currentState = nextState;

    let note: string | null = null;
    if (transition === 'cancel') {
      note = this.cancelReason;
    } else if (transition === 'respond') {
      note = `Radicado: ${this.responseRadicado}, Cotizado: $${this.quotedAmountPesos}`;
    } else if (transition === 'returnLegal') {
      note = (payload as Partial<ReturnLegalPayload>)?.observations ?? null;
    }

    const record: StateTransitionRecord = {
      rentalRequestId: this.id,
      fromStatus,
      toStatus: nextState.status,
      transition,
      actorId,
      note,
      occurredAt: new Date(),
    };

    this.transitions.push(record);
    return record;
  }
}
