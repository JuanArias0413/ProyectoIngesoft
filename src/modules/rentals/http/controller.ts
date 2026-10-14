import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../../shared/errors.js';
import { registerRentalSchema } from './schemas.js';
import { RegisterRentalUseCase } from '../application/registerRentalUseCase.js';

function parseBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMessages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    throw new ValidationError(errorMessages.join(', '), result.error.errors);
  }
  return result.data;
}

export class RentalController {
  constructor(private readonly registerRentalUseCase: RegisterRentalUseCase) {}

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
}
