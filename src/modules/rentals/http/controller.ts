import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../../shared/errors.js';
import { registerRentalSchema, respondRentalSchema } from './schemas.js';
import { RegisterRentalUseCase } from '../application/registerRentalUseCase.js';
import { RespondRentalUseCase } from '../application/respondRentalUseCase.js';

function parseBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMessages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    throw new ValidationError(errorMessages.join(', '), result.error.errors);
  }
  return result.data;
}

export interface RentalControllerDependencies {
  registerRentalUseCase: RegisterRentalUseCase;
  respondRentalUseCase?: RespondRentalUseCase;
}

export class RentalController {
  constructor(
    private readonly registerRentalUseCase: RegisterRentalUseCase,
    private readonly respondRentalUseCase?: RespondRentalUseCase,
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
}
