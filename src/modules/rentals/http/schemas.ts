import { z } from 'zod';

export const registerRentalSchema = z.object({
  customer: z.object({
    type: z.enum(['NATURAL', 'LEGAL']),
    documentType: z.string().min(1, 'El tipo de documento es obligatorio'),
    documentNumber: z.string().min(1, 'El número de documento es obligatorio'),
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    legalRepresentative: z.string().nullable().optional(),
    email: z.string().email('El correo electrónico no es válido'),
    phone: z.string().min(5, 'El teléfono es obligatorio'),
    address: z.string().min(3, 'La dirección es obligatoria'),
  }),
  spaceId: z.string().min(1, 'El identificador del espacio es obligatorio'),
  eventName: z.string().min(3, 'El nombre del evento debe tener al menos 3 caracteres'),
  eventDescription: z.string().min(5, 'La descripción del evento es obligatoria'),
  purpose: z.enum(['LUCRATIVE', 'NON_LUCRATIVE']),
  expectedAttendees: z.coerce.number().int().positive('El aforo esperado debe ser mayor a cero'),
  startsAt: z.coerce.date({ invalid_type_error: 'La fecha de inicio es inválida' }),
  endsAt: z.coerce.date({ invalid_type_error: 'La fecha de fin es inválida' }),
  channel: z.enum(['VERBAL', 'WRITTEN', 'EMAIL']),
  requestRadicado: z.string().nullable().optional(),
});

export const respondRentalSchema = z.object({
  responseRadicado: z.string().min(1, 'El número de radicado del oficio de respuesta es obligatorio (regla A-02)'),
});

export const draftContractSchema = z.object({
  object: z.string().optional(),
  additionalClauses: z.string().optional(),
});

export const registerPaymentSchema = z.object({
  receiptNumber: z.string().min(1, 'El número de recibo es obligatorio'),
  bankName: z.string().min(1, 'El nombre del banco es obligatorio'),
  voucherNumber: z.string().min(1, 'El número de comprobante/consignación es obligatorio'),
  amountPesos: z.coerce.number().int().positive('El monto debe ser un entero positivo'),
  invoiceNumber: z.string().min(1, 'El número de factura es obligatorio'),
  invoiceDate: z.coerce.date({ invalid_type_error: 'La fecha de factura es inválida' }),
  paidAt: z.coerce.date().optional(),
  voucherFileKey: z.string().optional(),
});

export const submitToLegalSchema = z.object({
  note: z.string().optional(),
});

const booleanCheckbox = z.preprocess(
  (val) => val === true || val === 'true' || val === 'on' || val === 1 || val === '1',
  z.boolean(),
);

export const approveLegalSchema = z.object({
  documentsOk: booleanCheckbox,
  customerDataOk: booleanCheckbox,
  clausesOk: booleanCheckbox,
  observations: z.string().optional(),
});

export const returnLegalSchema = z.object({
  observations: z.string().min(10, 'Las observaciones deben tener al menos 10 caracteres'),
});

export const resubmitToLegalSchema = z.object({
  object: z.string().optional(),
  additionalClauses: z.string().optional(),
  note: z.string().optional(),
  notes: z.string().optional(),
});

export const signAndNumberSchema = z.object({
  notes: z.string().optional(),
});

export const cancelRentalSchema = z.object({
  reason: z.string().min(10, 'El motivo de cancelación debe tener al menos 10 caracteres'),
});

export const listRentalsQuerySchema = z.object({
  status: z
    .enum([
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
    ])
    .optional(),
  search: z.string().optional(),
  spaceId: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().optional().default(20),
});
