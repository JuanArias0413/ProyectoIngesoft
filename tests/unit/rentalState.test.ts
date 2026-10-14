import { describe, it, expect } from 'vitest';
import {
  RentalStatus,
  TransitionName,
  UserRole,
  stateFor,
  RentalContext,
  CreateRentalContextInput,
} from '../../src/modules/rentals/domain/states/index.js';
import {
  InvalidTransitionError,
  ForbiddenError,
  ValidationError,
} from '../../src/shared/errors.js';

const ALL_STATES: readonly RentalStatus[] = [
  'REGISTERED',
  'RESPONDED',
  'DOCUMENTS_VERIFIED',
  'CONTRACT_DRAFTED',
  'PAID',
  'LEGAL_REVIEW',
  'RETURNED_BY_LEGAL',
  'PENDING_SIGNATURE',
  'LEGALIZED',
  'CANCELLED',
];

const ALL_TRANSITIONS: readonly TransitionName[] = [
  'respond',
  'verifyDocuments',
  'draftContract',
  'registerPayment',
  'submitToLegal',
  'approveLegal',
  'returnLegal',
  'resubmitToLegal',
  'signAndNumber',
  'cancel',
];

const ALL_ROLES: readonly UserRole[] = [
  'OFFICE_HEAD',
  'ADMIN_ASSISTANT',
  'LEGAL',
  'SECRETARY',
  'OPERATIONS_TECH',
  'MAINTENANCE_TECH',
];

// Definición estricta de la matriz estado × transición × roles autorizados según SPEC §7 y §8
const STATE_TRANSITION_ROLES: Record<
  RentalStatus,
  Partial<Record<TransitionName, UserRole[]>>
> = {
  REGISTERED: {
    respond: ['ADMIN_ASSISTANT'],
    cancel: ['ADMIN_ASSISTANT', 'OFFICE_HEAD'],
  },
  RESPONDED: {
    verifyDocuments: ['ADMIN_ASSISTANT'],
    cancel: ['ADMIN_ASSISTANT', 'OFFICE_HEAD'],
  },
  DOCUMENTS_VERIFIED: {
    draftContract: ['ADMIN_ASSISTANT'],
    cancel: ['ADMIN_ASSISTANT', 'OFFICE_HEAD'],
  },
  CONTRACT_DRAFTED: {
    registerPayment: ['ADMIN_ASSISTANT'],
    cancel: ['ADMIN_ASSISTANT', 'OFFICE_HEAD'],
  },
  PAID: {
    submitToLegal: ['ADMIN_ASSISTANT'],
    cancel: ['ADMIN_ASSISTANT', 'OFFICE_HEAD'],
  },
  LEGAL_REVIEW: {
    approveLegal: ['LEGAL'],
    returnLegal: ['LEGAL'],
    cancel: ['ADMIN_ASSISTANT', 'OFFICE_HEAD'],
  },
  RETURNED_BY_LEGAL: {
    resubmitToLegal: ['ADMIN_ASSISTANT'],
    cancel: ['ADMIN_ASSISTANT', 'OFFICE_HEAD'],
  },
  PENDING_SIGNATURE: {
    signAndNumber: ['SECRETARY'],
    cancel: ['ADMIN_ASSISTANT', 'OFFICE_HEAD'],
  },
  LEGALIZED: {}, // Terminal: sin transiciones
  CANCELLED: {}, // Terminal: sin transiciones
};

function makeContext(status: RentalStatus, overrides: Partial<CreateRentalContextInput> = {}) {
  return new RentalContext({
    id: 'req-123',
    status,
    customerId: 'cust-1',
    spaceId: 'space-1',
    eventName: 'Feria del Libro',
    eventDescription: 'Evento cultural de la ciudad',
    purpose: 'LUCRATIVE',
    expectedAttendees: 200,
    startsAt: new Date('2026-11-20T10:00:00Z'),
    endsAt: new Date('2026-11-20T14:00:00Z'),
    channel: 'WRITTEN',
    quotedAmountPesos: 1_800_000,
    ...overrides,
  });
}

function validPayloadFor(transition: TransitionName) {
  switch (transition) {
    case 'respond':
      return {
        responseRadicado: 'RAD-RESP-2026-001',
        quotedAmountPesos: 1_800_000,
        quotedTariffId: 'tariff-lucy-1',
      };
    case 'verifyDocuments':
      return { allMandatoryVerified: true };
    case 'draftContract':
      return { object: 'Objeto contractual', additionalClauses: 'Ninguna' };
    case 'registerPayment':
      return {
        receiptNumber: 'REC-001',
        bankName: 'Banco de Occidente',
        voucherNumber: 'VOUCH-9876',
        amountPesos: 1_800_000,
        invoiceNumber: 'FAC-1234',
        invoiceDate: new Date('2026-11-10T10:00:00Z'),
      };
    case 'submitToLegal':
      return {};
    case 'approveLegal':
      return {
        documentsOk: true,
        customerDataOk: true,
        clausesOk: true,
        observations: 'Aprobado sin objeciones',
      };
    case 'returnLegal':
      return {
        observations: 'Falta actualizar la cláusula de responsabilidad civil',
      };
    case 'resubmitToLegal':
      return { notes: 'Cláusula corregida' };
    case 'signAndNumber':
      return {};
    case 'cancel':
      return { reason: 'El solicitante desistió por motivos de fuerza mayor' };
  }
}

describe('Rental State Machine (Domain Unit Tests)', () => {
  describe('Fábrica stateFor', () => {
    it('retorna la instancia correspondiente a cada uno de los 10 estados', () => {
      for (const status of ALL_STATES) {
        const state = stateFor(status);
        expect(state.status).toBe(status);
        expect(state.label).toBeDefined();
      }
    });

    it('falla con estados no reconocidos', () => {
      expect(() => stateFor('UNKNOWN' as RentalStatus)).toThrow();
    });
  });

  describe('Table-driven: Todas las combinaciones Estado × Transición × Rol (600 combinaciones)', () => {
    for (const status of ALL_STATES) {
      for (const transition of ALL_TRANSITIONS) {
        for (const role of ALL_ROLES) {
          const allowedRoles = STATE_TRANSITION_ROLES[status][transition];
          const isTransitionAllowedInState = allowedRoles !== undefined;
          const isRoleAuthorized = allowedRoles?.includes(role) ?? false;

          it(`Estado [${status}] + Transición [${transition}] + Rol [${role}] → ${
            isRoleAuthorized
              ? 'PERMITIDO (200)'
              : isTransitionAllowedInState
                ? 'FORBIDDEN (403)'
                : 'INVALID_TRANSITION (409)'
          }`, () => {
            const state = stateFor(status);
            const canResult = state.can(transition, role);

            if (isRoleAuthorized) {
              expect(canResult.allowed).toBe(true);

              // Probar la ejecución real de la transición con payload válido
              const ctx = makeContext(status);
              const payload = validPayloadFor(transition);
              const record = ctx.transition(transition, role, payload, 'user-actor-1');

              expect(record.rentalRequestId).toBe(ctx.id);
              expect(record.fromStatus).toBe(status);
              expect(record.transition).toBe(transition);
              expect(record.actorId).toBe('user-actor-1');
              expect(ctx.status).toBe(record.toStatus);
              expect(ctx.transitions.length).toBe(1);
            } else if (isTransitionAllowedInState) {
              // La transición existe para este estado, pero este rol no tiene permiso
              expect(canResult.allowed).toBe(false);

              const ctx = makeContext(status);
              const payload = validPayloadFor(transition);
              expect(() => ctx.transition(transition, role, payload)).toThrow(
                ForbiddenError,
              );
            } else {
              // La transición no existe para este estado
              expect(canResult.allowed).toBe(false);

              const ctx = makeContext(status);
              const payload = validPayloadFor(transition);
              expect(() => ctx.transition(transition, role, payload)).toThrow(
                InvalidTransitionError,
              );
            }
          });
        }
      }
    }
  });

  describe('Precondiciones y validaciones específicas de transiciones', () => {
    it('T2 respond: rechaza sin radicado de respuesta (A-02)', () => {
      const ctx = makeContext('REGISTERED');
      expect(() =>
        ctx.transition('respond', 'ADMIN_ASSISTANT', {
          responseRadicado: '',
          quotedAmountPesos: 1_800_000,
          quotedTariffId: 't-1',
        }),
      ).toThrow(ValidationError);
    });

    it('T2 respond: rechaza con valor cotizado <= 0 o sin tarifa', () => {
      const ctx = makeContext('REGISTERED');
      expect(() =>
        ctx.transition('respond', 'ADMIN_ASSISTANT', {
          responseRadicado: 'RAD-001',
          quotedAmountPesos: 0,
          quotedTariffId: 't-1',
        }),
      ).toThrow(ValidationError);

      expect(() =>
        ctx.transition('respond', 'ADMIN_ASSISTANT', {
          responseRadicado: 'RAD-001',
          quotedAmountPesos: 1_800_000,
          quotedTariffId: '',
        }),
      ).toThrow(ValidationError);
    });

    it('T3 verifyDocuments: rechaza si allMandatoryVerified no es true', () => {
      const ctx = makeContext('RESPONDED');
      expect(() =>
        ctx.transition('verifyDocuments', 'ADMIN_ASSISTANT', {
          allMandatoryVerified: false,
        }),
      ).toThrow(ValidationError);
    });

    it('T5 registerPayment: rechaza datos de pago incompletos', () => {
      const ctx = makeContext('CONTRACT_DRAFTED', { quotedAmountPesos: 500_000 });
      expect(() =>
        ctx.transition('registerPayment', 'ADMIN_ASSISTANT', {
          receiptNumber: '',
          bankName: 'Banco',
          voucherNumber: '123',
          amountPesos: 500_000,
          invoiceNumber: 'FAC-1',
          invoiceDate: new Date(),
        }),
      ).toThrow(ValidationError);
    });

    it('T5 registerPayment: rechaza si el monto difiere del valor cotizado (A-08, AC-06.2)', () => {
      const ctx = makeContext('CONTRACT_DRAFTED', { quotedAmountPesos: 1_000_000 });
      expect(() =>
        ctx.transition('registerPayment', 'ADMIN_ASSISTANT', {
          receiptNumber: 'REC-1',
          bankName: 'Banco',
          voucherNumber: '123',
          amountPesos: 950_000, // Difiere de 1,000,000
          invoiceNumber: 'FAC-1',
          invoiceDate: new Date(),
        }),
      ).toThrow(ValidationError);
    });

    it('T7 approveLegal: rechaza si falta alguna de las 3 verificaciones (CAR-07, AC-07.2)', () => {
      const ctx = makeContext('LEGAL_REVIEW');
      expect(() =>
        ctx.transition('approveLegal', 'LEGAL', {
          documentsOk: true,
          customerDataOk: false, // Incompleta
          clausesOk: true,
        }),
      ).toThrow(ValidationError);
    });

    it('T8 returnLegal: rechaza si observaciones < 10 caracteres (CAR-07, AC-07.3)', () => {
      const ctx = makeContext('LEGAL_REVIEW');
      expect(() =>
        ctx.transition('returnLegal', 'LEGAL', {
          observations: 'Mal', // Menos de 10 caracteres
        }),
      ).toThrow(ValidationError);
    });

    it('T5 registerPayment: rechaza cada campo faltante o monto <= 0', () => {
      const ctx = makeContext('CONTRACT_DRAFTED', { quotedAmountPesos: 500_000 });

      // Sin banco
      expect(() =>
        ctx.transition('registerPayment', 'ADMIN_ASSISTANT', {
          receiptNumber: 'REC-1',
          bankName: '',
          voucherNumber: '123',
          amountPesos: 500_000,
          invoiceNumber: 'FAC-1',
          invoiceDate: new Date(),
        }),
      ).toThrow(ValidationError);

      // Sin comprobante
      expect(() =>
        ctx.transition('registerPayment', 'ADMIN_ASSISTANT', {
          receiptNumber: 'REC-1',
          bankName: 'Banco',
          voucherNumber: '',
          amountPesos: 500_000,
          invoiceNumber: 'FAC-1',
          invoiceDate: new Date(),
        }),
      ).toThrow(ValidationError);

      // Sin factura
      expect(() =>
        ctx.transition('registerPayment', 'ADMIN_ASSISTANT', {
          receiptNumber: 'REC-1',
          bankName: 'Banco',
          voucherNumber: '123',
          amountPesos: 500_000,
          invoiceNumber: '',
          invoiceDate: new Date(),
        }),
      ).toThrow(ValidationError);

      // Monto <= 0
      expect(() =>
        ctx.transition('registerPayment', 'ADMIN_ASSISTANT', {
          receiptNumber: 'REC-1',
          bankName: 'Banco',
          voucherNumber: '123',
          amountPesos: 0,
          invoiceNumber: 'FAC-1',
          invoiceDate: new Date(),
        }),
      ).toThrow(ValidationError);
    });

    it('T11 cancel: rechaza si motivo de cancelación < 10 caracteres en todos los estados no terminales', () => {
      const nonTerminal: RentalStatus[] = [
        'REGISTERED',
        'RESPONDED',
        'DOCUMENTS_VERIFIED',
        'CONTRACT_DRAFTED',
        'PAID',
        'LEGAL_REVIEW',
        'RETURNED_BY_LEGAL',
        'PENDING_SIGNATURE',
      ];

      for (const st of nonTerminal) {
        const ctx = makeContext(st);
        expect(() =>
          ctx.transition('cancel', 'ADMIN_ASSISTANT', {
            reason: 'Corto',
          }),
        ).toThrow(ValidationError);
      }
    });
  });

  describe('Flujos completos de extremo a extremo', () => {
    it('Camino feliz completo (REGISTERED hasta LEGALIZED)', () => {
      const ctx = makeContext('REGISTERED');

      // T2: Auxiliar responde
      ctx.transition('respond', 'ADMIN_ASSISTANT', validPayloadFor('respond'), 'auxiliar-1');
      expect(ctx.status).toBe('RESPONDED');

      // T3: Auxiliar verifica documentos
      ctx.transition(
        'verifyDocuments',
        'ADMIN_ASSISTANT',
        validPayloadFor('verifyDocuments'),
        'auxiliar-1',
      );
      expect(ctx.status).toBe('DOCUMENTS_VERIFIED');

      // T4: Auxiliar elabora contrato
      ctx.transition(
        'draftContract',
        'ADMIN_ASSISTANT',
        validPayloadFor('draftContract'),
        'auxiliar-1',
      );
      expect(ctx.status).toBe('CONTRACT_DRAFTED');

      // T5: Auxiliar registra pago
      ctx.transition(
        'registerPayment',
        'ADMIN_ASSISTANT',
        validPayloadFor('registerPayment'),
        'auxiliar-1',
      );
      expect(ctx.status).toBe('PAID');

      // T6: Auxiliar envía a Jurídica
      ctx.transition(
        'submitToLegal',
        'ADMIN_ASSISTANT',
        validPayloadFor('submitToLegal'),
        'auxiliar-1',
      );
      expect(ctx.status).toBe('LEGAL_REVIEW');

      // T7: Jurídica aprueba
      ctx.transition('approveLegal', 'LEGAL', validPayloadFor('approveLegal'), 'juridica-1');
      expect(ctx.status).toBe('PENDING_SIGNATURE');

      // T10: Secretario firma y legaliza
      ctx.transition(
        'signAndNumber',
        'SECRETARY',
        validPayloadFor('signAndNumber'),
        'secretario-1',
      );
      expect(ctx.status).toBe('LEGALIZED');

      expect(ctx.transitions.length).toBe(7);
      expect(ctx.currentState.allowedTransitions()).toEqual([]);
    });

    it('Ciclo de devolución y reenvío de Jurídica (LEGAL_REVIEW ↔ RETURNED_BY_LEGAL)', () => {
      const ctx = makeContext('LEGAL_REVIEW');

      // T8: Jurídica devuelve con observaciones
      ctx.transition('returnLegal', 'LEGAL', validPayloadFor('returnLegal'), 'juridica-1');
      expect(ctx.status).toBe('RETURNED_BY_LEGAL');

      // T9: Auxiliar corrige y reenvía
      ctx.transition(
        'resubmitToLegal',
        'ADMIN_ASSISTANT',
        validPayloadFor('resubmitToLegal'),
        'auxiliar-1',
      );
      expect(ctx.status).toBe('LEGAL_REVIEW');

      // T7: Jurídica aprueba
      ctx.transition('approveLegal', 'LEGAL', validPayloadFor('approveLegal'), 'juridica-1');
      expect(ctx.status).toBe('PENDING_SIGNATURE');
    });

    it('Cancelación permitida por el Jefe de Oficina desde PAID', () => {
      const ctx = makeContext('PAID');
      ctx.transition('cancel', 'OFFICE_HEAD', validPayloadFor('cancel'), 'jefe-1');
      expect(ctx.status).toBe('CANCELLED');
      expect(ctx.cancelReason).toContain('desistió');
      expect(ctx.currentState.allowedTransitions()).toEqual([]);
    });

    it('Estados terminales (LEGALIZED y CANCELLED) rechazan can y apply directamente', () => {
      const legalized = stateFor('LEGALIZED');
      const cancelled = stateFor('CANCELLED');
      const ctx = makeContext('LEGALIZED');

      expect(legalized.allowedTransitions()).toEqual([]);
      expect(legalized.can('respond', 'ADMIN_ASSISTANT').allowed).toBe(false);
      expect(() => legalized.apply(ctx, 'respond')).toThrow(InvalidTransitionError);

      expect(cancelled.allowedTransitions()).toEqual([]);
      expect(cancelled.can('respond', 'ADMIN_ASSISTANT').allowed).toBe(false);
      expect(() => cancelled.apply(ctx, 'respond')).toThrow(InvalidTransitionError);
    });

    it('Cada estado no terminal lanza InvalidTransitionError al invocar apply directamente con una transición no soportada', () => {
      const nonTerminalStates: RentalStatus[] = [
        'REGISTERED',
        'RESPONDED',
        'DOCUMENTS_VERIFIED',
        'CONTRACT_DRAFTED',
        'PAID',
        'LEGAL_REVIEW',
        'RETURNED_BY_LEGAL',
        'PENDING_SIGNATURE',
      ];

      for (const status of nonTerminalStates) {
        const state = stateFor(status);
        const ctx = makeContext(status);
        expect(() => state.apply(ctx, 'unknown_trans' as unknown as TransitionName)).toThrow(
          InvalidTransitionError,
        );
      }
    });

    it('RentalContext can delega correctamente en el estado actual', () => {
      const ctx = makeContext('REGISTERED');
      expect(ctx.can('respond', 'ADMIN_ASSISTANT').allowed).toBe(true);
      expect(ctx.can('signAndNumber', 'SECRETARY').allowed).toBe(false);
    });

    it('RentalContext preserva transiciones previas al inicializarse', () => {
      const ctx = makeContext('PAID', {
        transitions: [
          {
            rentalRequestId: 'req-123',
            fromStatus: 'CONTRACT_DRAFTED',
            toStatus: 'PAID',
            transition: 'registerPayment',
            actorId: 'user-1',
            note: null,
            occurredAt: new Date(),
          },
        ],
      });
      expect(ctx.transitions.length).toBe(1);
    });
  });
});

