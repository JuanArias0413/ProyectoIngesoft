import fs from 'node:fs';
import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ValidationError } from '../../../shared/errors.js';
import { prisma } from '../../../infra/prisma.js';
import {
  registerRentalSchema,
  respondRentalSchema,
  draftContractSchema,
  registerPaymentSchema,
  submitToLegalSchema,
  approveLegalSchema,
  returnLegalSchema,
  resubmitToLegalSchema,
  signAndNumberSchema,
  cancelRentalSchema,
  listRentalsQuerySchema,
} from './schemas.js';
import { RegisterRentalUseCase } from '../application/registerRentalUseCase.js';
import { RespondRentalUseCase } from '../application/respondRentalUseCase.js';
import { VerifyDocumentsUseCase } from '../application/verifyDocumentsUseCase.js';
import { ManageDocumentsUseCase } from '../application/manageDocumentsUseCase.js';
import { DraftContractUseCase } from '../application/draftContractUseCase.js';
import { UpdateContractUseCase } from '../application/updateContractUseCase.js';
import { RegisterPaymentUseCase } from '../application/registerPaymentUseCase.js';
import { SubmitToLegalUseCase } from '../application/submitToLegalUseCase.js';
import { ApproveLegalUseCase } from '../application/approveLegalUseCase.js';
import { ReturnLegalUseCase } from '../application/returnLegalUseCase.js';
import { ResubmitToLegalUseCase } from '../application/resubmitToLegalUseCase.js';
import { SignAndNumberUseCase } from '../application/signAndNumberUseCase.js';
import { CancelRentalUseCase } from '../application/cancelRentalUseCase.js';
import { ListRentalsUseCase } from '../application/listRentalsUseCase.js';
import { GetRentalDetailUseCase } from '../application/getRentalDetailUseCase.js';
import { resolveStoragePath } from '../infra/fileStorage.js';

function parseBody<T extends z.ZodTypeAny>(schema: T, data: unknown): z.output<T> {
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
    private readonly approveLegalUseCase?: ApproveLegalUseCase,
    private readonly returnLegalUseCase?: ReturnLegalUseCase,
    private readonly resubmitToLegalUseCase?: ResubmitToLegalUseCase,
    private readonly signAndNumberUseCase?: SignAndNumberUseCase,
    private readonly cancelRentalUseCase?: CancelRentalUseCase,
    private readonly listRentalsUseCase?: ListRentalsUseCase,
    private readonly getRentalDetailUseCase?: GetRentalDetailUseCase,
    private readonly prismaClient: PrismaClient = prisma,
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

  public async approveLegal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!this.approveLegalUseCase) {
        res.status(500).json({ error: 'Caso de uso ApproveLegalUseCase no inyectado' });
        return;
      }

      const id = String(req.params.id);
      const input = parseBody(approveLegalSchema, req.body);

      const result = await this.approveLegalUseCase.execute({
        rentalRequestId: id,
        documentsOk: input.documentsOk,
        customerDataOk: input.customerDataOk,
        clausesOk: input.clausesOk,
        observations: input.observations,
        actorId: user.id,
        actorRole: user.role,
      });

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.redirect(`/solicitudes/${id}`);
        return;
      }

      res.status(200).json({
        message: 'Revisión jurídica aprobada con éxito',
        rentalRequestId: result.rentalRequest.id,
        status: result.rentalRequest.status,
        legalReview: result.legalReview,
      });
    } catch (error) {
      next(error);
    }
  }

  public async returnLegal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!this.returnLegalUseCase) {
        res.status(500).json({ error: 'Caso de uso ReturnLegalUseCase no inyectado' });
        return;
      }

      const id = String(req.params.id);
      const input = parseBody(returnLegalSchema, req.body);

      const result = await this.returnLegalUseCase.execute({
        rentalRequestId: id,
        observations: input.observations,
        actorId: user.id,
        actorRole: user.role,
      });

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.redirect(`/solicitudes/${id}`);
        return;
      }

      res.status(200).json({
        message: 'Contrato devuelto con observaciones para corrección',
        rentalRequestId: result.rentalRequest.id,
        status: result.rentalRequest.status,
        legalReview: result.legalReview,
      });
    } catch (error) {
      next(error);
    }
  }

  public async resubmitToLegal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!this.resubmitToLegalUseCase) {
        res.status(500).json({ error: 'Caso de uso ResubmitToLegalUseCase no inyectado' });
        return;
      }

      const id = String(req.params.id);
      const input = parseBody(resubmitToLegalSchema, req.body || {});

      const result = await this.resubmitToLegalUseCase.execute({
        rentalRequestId: id,
        object: input.object,
        additionalClauses: input.additionalClauses,
        note: input.note || input.notes,
        actorId: user.id,
        actorRole: user.role,
      });

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.redirect(`/solicitudes/${id}`);
        return;
      }

      res.status(200).json({
        message: 'Solicitud subsanada y reenviada a revisión jurídica',
        rentalRequestId: result.rentalRequest.id,
        status: result.rentalRequest.status,
        contract: result.contract,
        version: result.version,
      });
    } catch (error) {
      next(error);
    }
  }

  public async signAndNumber(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!this.signAndNumberUseCase) {
        res.status(500).json({ error: 'Caso de uso SignAndNumberUseCase no inyectado' });
        return;
      }

      const id = String(req.params.id);
      const input = parseBody(signAndNumberSchema, req.body || {});

      const result = await this.signAndNumberUseCase.execute({
        rentalRequestId: id,
        actorId: user.id,
        actorRole: user.role,
        notes: input.notes,
      });

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.redirect(`/solicitudes/${id}`);
        return;
      }

      res.status(200).json({
        message: 'Contrato firmado y numerado oficialmente (legalizado)',
        rentalRequestId: result.rentalRequest.id,
        status: result.rentalRequest.status,
        contractNumber: result.contractNumber,
        contract: result.contract,
      });
    } catch (error) {
      next(error);
    }
  }

  public async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!this.cancelRentalUseCase) {
        res.status(500).json({ error: 'Caso de uso CancelRentalUseCase no inyectado' });
        return;
      }

      const id = String(req.params.id);
      const input = parseBody(cancelRentalSchema, req.body || {});

      const result = await this.cancelRentalUseCase.execute({
        rentalRequestId: id,
        reason: input.reason,
        actorId: user.id,
        actorRole: user.role,
      });

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.redirect(`/solicitudes/${id}`);
        return;
      }

      res.status(200).json({
        message: 'Solicitud cancelada con éxito',
        rentalRequestId: result.rentalRequest.id,
        status: result.rentalRequest.status,
        cancelReason: result.rentalRequest.cancelReason,
        previousStatus: result.previousStatus,
      });
    } catch (error) {
      next(error);
    }
  }

  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const queryParsed = listRentalsQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        const errorMessages = queryParsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        throw new ValidationError(errorMessages.join(', '), queryParsed.error.errors);
      }

      const { status, search, q, spaceId, page, pageSize } = queryParsed.data;
      const term = search || q;

      const listUseCase = this.listRentalsUseCase ?? new ListRentalsUseCase(this.prismaClient);
      const result = await listUseCase.execute({
        status,
        search: term,
        spaceId,
        page,
        pageSize,
      });

      const formattedItems = result.items.map((item) => ({
        ...item,
        startsAtFormatted: item.startsAt ? new Date(item.startsAt).toLocaleString('es-CO') : '',
        endsAtFormatted: item.endsAt ? new Date(item.endsAt).toLocaleString('es-CO') : '',
        createdAtFormatted: item.createdAt ? new Date(item.createdAt).toLocaleString('es-CO') : '',
        customerName: item.customer?.name,
        customerDocument: item.customer?.documentNumber,
        spaceName: item.space?.name,
        venueName: item.space?.venue?.name,
      }));

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.render('pages/solicitudes/index.njk', {
          requests: formattedItems,
          query: { q: term, status },
          pagination: result.pagination,
          currentUser: user,
          user,
        });
        return;
      }

      res.status(200).json({
        items: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  public async detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const id = String(req.params.id);
      const detailUseCase = this.getRentalDetailUseCase ?? new GetRentalDetailUseCase(this.prismaClient);
      const result = await detailUseCase.execute({
        rentalRequestId: id,
        actorRole: user.role,
      });

      const rental = result.rental;
      const formattedRental = {
        ...rental,
        createdAtFormatted: rental.createdAt ? new Date(rental.createdAt).toLocaleString('es-CO') : '',
        startsAtFormatted: rental.startsAt ? new Date(rental.startsAt).toLocaleString('es-CO') : '',
        endsAtFormatted: rental.endsAt ? new Date(rental.endsAt).toLocaleString('es-CO') : '',
        quotedAmountPesosFormatted: rental.quotedAmountPesos ? rental.quotedAmountPesos.toLocaleString('es-CO') : '0',
        transitions: rental.stateTransitions.map((t) => ({
          ...t,
          occurredAtFormatted: t.occurredAt ? new Date(t.occurredAt).toLocaleString('es-CO') : '',
          actorName: t.actor?.name,
          actorRole: t.actor?.role,
        })),
      };

      if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        res.render('pages/solicitudes/detalle.njk', {
          solicitud: formattedRental,
          rental: formattedRental,
          allowedTransitions: result.allowedTransitions,
          currentUser: user,
          user,
          csrfToken: (res.locals.csrfToken as string) || '',
        });
        return;
      }

      res.status(200).json({
        rental: result.rental,
        allowedTransitions: result.allowedTransitions,
      });
    } catch (error) {
      next(error);
    }
  }

  public async renderNewForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.session?.user;
      if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const [venues, spaces] = await Promise.all([
        this.prismaClient.venue.findMany({ orderBy: { name: 'asc' } }),
        this.prismaClient.space.findMany({
          where: { active: true },
          include: { venue: true },
          orderBy: { name: 'asc' },
        }),
      ]);

      res.render('pages/solicitudes/nueva.njk', {
        venues,
        spaces,
        values: {},
        errors: {},
        currentUser: user,
        user,
        csrfToken: (res.locals.csrfToken as string) || '',
      });
    } catch (error) {
      next(error);
    }
  }
}


