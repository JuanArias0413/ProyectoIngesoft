import fs from 'node:fs';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../../shared/errors.js';
import {
  registerRentalSchema,
  respondRentalSchema,
  draftContractSchema,
  registerPaymentSchema,
  submitToLegalSchema,
} from './schemas.js';
import { RegisterRentalUseCase } from '../application/registerRentalUseCase.js';
import { RespondRentalUseCase } from '../application/respondRentalUseCase.js';
import { VerifyDocumentsUseCase } from '../application/verifyDocumentsUseCase.js';
import { ManageDocumentsUseCase } from '../application/manageDocumentsUseCase.js';
import { DraftContractUseCase } from '../application/draftContractUseCase.js';
import { UpdateContractUseCase } from '../application/updateContractUseCase.js';
import { RegisterPaymentUseCase } from '../application/registerPaymentUseCase.js';
import { SubmitToLegalUseCase } from '../application/submitToLegalUseCase.js';
import { resolveStoragePath } from '../infra/fileStorage.js';

function parseBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMessages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    throw new ValidationError(errorMessages.join(', '), result.error.errors);
  }
  return result.data;
}

export class RentalController {
  constructor(
    private readonly registerRentalUseCase: RegisterRentalUseCase,
    private readonly respondRentalUseCase?: RespondRentalUseCase,
    private readonly verifyDocumentsUseCase?: VerifyDocumentsUseCase,
    private readonly manageDocumentsUseCase?: ManageDocumentsUseCase,
    private readonly draftContractUseCase?: DraftContractUseCase,
    private readonly updateContractUseCase?: UpdateContractUseCase,
    private readonly registerPaymentUseCase?: RegisterPaymentUseCase,
    private readonly submitToLegalUseCase?: SubmitToLegalUseCase,
  ) {}

  public async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const input = parseBody(registerRentalSchema, req.body);
      const result = await this.registerRentalUseCase.execute({
        ...input,
        actorId: user.id,
        actorRole: user.role,
      });

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.redirect(`/solicitudes/${result.rentalRequest.id}`);
        return;
      }

      res.status(201).json({
        message: 'Solicitud registrada con éxito',
        rentalRequestId: result.rentalRequest.id,
        customerId: result.customerId,
        reservationId: result.reservationId,
        documentCount: result.documentCount,
        status: result.rentalRequest.status,
      });
    } catch (error) {
      next(error);
    }
  }

  public async respond(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!this.respondRentalUseCase) {
        res.status(500).json({ error: 'Caso de uso RespondRentalUseCase no inyectado' });
        return;
      }

      const input = parseBody(respondRentalSchema, req.body);
      const id = String(req.params.id);

      const result = await this.respondRentalUseCase.execute({
        rentalRequestId: id,
        responseRadicado: input.responseRadicado,
        actorId: user.id,
        actorRole: user.role,
      });

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.redirect(`/solicitudes/${id}`);
        return;
      }

      res.status(200).json({
        message: 'Solicitud respondida con éxito',
        rentalRequestId: result.rentalRequest.id,
        status: result.rentalRequest.status,
        quotedAmountPesos: result.quotedAmountPesos,
        responseRadicado: result.responseRadicado,
        quotedTariffId: result.quotedTariffId,
      });
    } catch (error) {
      next(error);
    }
  }

  public async markDocumentReceived(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!this.manageDocumentsUseCase) {
        res.status(500).json({ error: 'Caso de uso ManageDocumentsUseCase no inyectado' });
        return;
      }

      const id = String(req.params.id);
      const code = String(req.params.code);
      const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;

      const updatedDoc = await this.manageDocumentsUseCase.markReceived({
        rentalRequestId: id,
        requirementCode: code,
        actorId: user.id,
        notes,
      });

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.redirect(`/solicitudes/${id}`);
        return;
      }

      res.status(200).json({
        message: 'Documento marcado como recibido',
        document: updatedDoc,
      });
    } catch (error) {
      next(error);
    }
  }

  public async uploadClientDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!this.manageDocumentsUseCase) {
        res.status(500).json({ error: 'Caso de uso ManageDocumentsUseCase no inyectado' });
        return;
      }

      const id = String(req.params.id);
      const code = String(req.params.code);

      if (!req.file) {
        throw new ValidationError('Debe adjuntar un archivo válido (PDF, JPG o PNG de máx 5 MB) (AC-04.2)');
      }

      const updatedDoc = await this.manageDocumentsUseCase.attachFile({
        rentalRequestId: id,
        requirementCode: code,
        fileKey: req.file.filename,
        actorId: user.id,
      });

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.redirect(`/solicitudes/${id}`);
        return;
      }

      res.status(200).json({
        message: 'Archivo adjuntado con éxito',
        fileKey: req.file.filename,
        document: updatedDoc,
      });
    } catch (error) {
      next(error);
    }
  }

  public async verifyDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!this.manageDocumentsUseCase) {
        res.status(500).json({ error: 'Caso de uso ManageDocumentsUseCase no inyectado' });
        return;
      }

      const id = String(req.params.id);
      const code = String(req.params.code);

      const updatedDoc = await this.manageDocumentsUseCase.verifyDocument({
        rentalRequestId: id,
        requirementCode: code,
        actorId: user.id,
      });

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.redirect(`/solicitudes/${id}`);
        return;
      }

      res.status(200).json({
        message: 'Documento verificado con éxito',
        document: updatedDoc,
      });
    } catch (error) {
      next(error);
    }
  }

  public async verifyDocumentsTransition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!this.verifyDocumentsUseCase) {
        res.status(500).json({ error: 'Caso de uso VerifyDocumentsUseCase no inyectado' });
        return;
      }

      const id = String(req.params.id);

      const result = await this.verifyDocumentsUseCase.execute({
        rentalRequestId: id,
        actorId: user.id,
        actorRole: user.role,
      });

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.redirect(`/solicitudes/${id}`);
        return;
      }

      res.status(200).json({
        message: 'Documentos obligatorios verificados con éxito',
        rentalRequestId: result.rentalRequest.id,
        status: result.rentalRequest.status,
        verifiedCount: result.verifiedCount,
        mandatoryCount: result.mandatoryCount,
      });
    } catch (error) {
      next(error);
    }
  }

  public async downloadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const key = String(req.params.key);
      const fullPath = resolveStoragePath(key);

      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ error: 'El archivo solicitado no existe' });
        return;
      }

      res.sendFile(fullPath);
    } catch (error) {
      next(error);
    }
  }

  public async draftContract(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!this.draftContractUseCase) {
        res.status(500).json({ error: 'Caso de uso DraftContractUseCase no inyectado' });
        return;
      }

      const id = String(req.params.id);
      const input = parseBody(draftContractSchema, req.body || {});

      const result = await this.draftContractUseCase.execute({
        rentalRequestId: id,
        object: input.object,
        additionalClauses: input.additionalClauses,
        actorId: user.id,
        actorRole: user.role,
      });

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.redirect(`/solicitudes/${id}`);
        return;
      }

      res.status(200).json({
        message: 'Estudio previo y minuta de contrato elaborados con éxito (v1)',
        rentalRequestId: result.rentalRequest.id,
        status: result.rentalRequest.status,
        contract: result.contract,
      });
    } catch (error) {
      next(error);
    }
  }

  public async updateContract(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!this.updateContractUseCase) {
        res.status(500).json({ error: 'Caso de uso UpdateContractUseCase no inyectado' });
        return;
      }

      const id = String(req.params.id);
      const input = parseBody(draftContractSchema, req.body || {});

      const result = await this.updateContractUseCase.execute({
        rentalRequestId: id,
        object: input.object,
        additionalClauses: input.additionalClauses,
        actorId: user.id,
        actorRole: user.role,
      });

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.redirect(`/solicitudes/${id}`);
        return;
      }

      res.status(200).json({
        message: 'Contrato actualizado con éxito',
        rentalRequestId: id,
        contract: result.contract,
        version: result.version,
      });
    } catch (error) {
      next(error);
    }
  }

  public async registerPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!this.registerPaymentUseCase) {
        res.status(500).json({ error: 'Caso de uso RegisterPaymentUseCase no inyectado' });
        return;
      }

      const id = String(req.params.id);
      const input = parseBody(registerPaymentSchema, req.body);
      const voucherFileKey = req.file?.filename || input.voucherFileKey || null;

      const result = await this.registerPaymentUseCase.execute({
        rentalRequestId: id,
        receiptNumber: input.receiptNumber,
        bankName: input.bankName,
        voucherNumber: input.voucherNumber,
        paidAt: input.paidAt,
        amountPesos: input.amountPesos,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        voucherFileKey,
        actorId: user.id,
        actorRole: user.role,
      });

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.redirect(`/solicitudes/${id}`);
        return;
      }

      res.status(200).json({
        message: 'Pago registrado con éxito',
        rentalRequestId: result.rentalRequest.id,
        status: result.rentalRequest.status,
        payment: result.payment,
      });
    } catch (error) {
      next(error);
    }
  }

  public async submitToLegal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!this.submitToLegalUseCase) {
        res.status(500).json({ error: 'Caso de uso SubmitToLegalUseCase no inyectado' });
        return;
      }

      const id = String(req.params.id);
      const input = parseBody(submitToLegalSchema, req.body || {});

      const result = await this.submitToLegalUseCase.execute({
        rentalRequestId: id,
        actorId: user.id,
        actorRole: user.role,
        note: input.note,
      });

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.redirect(`/solicitudes/${id}`);
        return;
      }

      res.status(200).json({
        message: 'Solicitud enviada a revisión jurídica con éxito',
        rentalRequestId: result.rentalRequest.id,
        status: result.rentalRequest.status,
      });
    } catch (error) {
      next(error);
    }
  }
}


