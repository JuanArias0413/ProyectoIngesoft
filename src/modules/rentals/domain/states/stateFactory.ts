import { RentalStatus } from './types.js';
import { RentalState } from './rentalState.js';
import { RegisteredState } from './registeredState.js';
import { RespondedState } from './respondedState.js';
import { DocumentsVerifiedState } from './documentsVerifiedState.js';
import { ContractDraftedState } from './contractDraftedState.js';
import { PaidState } from './paidState.js';
import { LegalReviewState } from './legalReviewState.js';
import { ReturnedByLegalState } from './returnedByLegalState.js';
import { PendingSignatureState } from './pendingSignatureState.js';
import { LegalizedState } from './legalizedState.js';
import { CancelledState } from './cancelledState.js';

const stateRegistry: Record<RentalStatus, RentalState> = {
  REGISTERED: new RegisteredState(),
  RESPONDED: new RespondedState(),
  DOCUMENTS_VERIFIED: new DocumentsVerifiedState(),
  CONTRACT_DRAFTED: new ContractDraftedState(),
  PAID: new PaidState(),
  LEGAL_REVIEW: new LegalReviewState(),
  RETURNED_BY_LEGAL: new ReturnedByLegalState(),
  PENDING_SIGNATURE: new PendingSignatureState(),
  LEGALIZED: new LegalizedState(),
  CANCELLED: new CancelledState(),
};

export function stateFor(status: RentalStatus): RentalState {
  const state = stateRegistry[status];
  if (!state) {
    throw new Error(`Estado desconocido en la máquina de alquiler: ${String(status)}`);
  }
  return state;
}
