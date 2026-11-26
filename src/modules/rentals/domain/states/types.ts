export type RentalStatus =
  | 'REGISTERED'
  | 'RESPONDED'
  | 'DOCUMENTS_VERIFIED'
  | 'CONTRACT_DRAFTED'
  | 'PAID'
  | 'LEGAL_REVIEW'
  | 'RETURNED_BY_LEGAL'
  | 'PENDING_SIGNATURE'
  | 'LEGALIZED'
  | 'CANCELLED';

export type TransitionName =
  | 'respond'
  | 'verifyDocuments'
  | 'draftContract'
  | 'registerPayment'
  | 'submitToLegal'
  | 'approveLegal'
  | 'returnLegal'
  | 'resubmitToLegal'
  | 'signAndNumber'
  | 'cancel';

export type UserRole =
  | 'OFFICE_HEAD'
  | 'ADMIN_ASSISTANT'
  | 'LEGAL'
  | 'SECRETARY'
  | 'OPERATIONS_TECH'
  | 'MAINTENANCE_TECH';

export interface CanTransitionResult {
  allowed: boolean;
  reason?: string;
}

export interface StateTransitionRecord {
  id?: string;
  rentalRequestId: string;
  fromStatus: RentalStatus;
  toStatus: RentalStatus;
  transition: TransitionName;
  actorId: string;
  note: string | null;
  occurredAt: Date;
}

export interface RespondPayload {
  responseRadicado: string;
  quotedAmountPesos: number;
  quotedTariffId: string;
}

export interface VerifyDocumentsPayload {
  allMandatoryVerified: boolean;
}

export interface DraftContractPayload {
  object?: string;
  additionalClauses?: string;
}

export interface RegisterPaymentPayload {
  receiptNumber: string;
  bankName: string;
  voucherNumber: string;
  amountPesos: number;
  invoiceNumber: string;
  invoiceDate: Date;
  paidAt?: Date;
}

export interface ApproveLegalPayload {
  documentsOk: boolean;
  customerDataOk: boolean;
  clausesOk: boolean;
  observations?: string;
}

export interface ReturnLegalPayload {
  observations: string;
}

export interface ResubmitToLegalPayload {
  notes?: string;
}

export interface SignAndNumberPayload {
  signedAt?: Date;
  signedById?: string;
}

export interface CancelPayload {
  reason: string;
}
