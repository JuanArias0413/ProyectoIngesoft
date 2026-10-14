import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../../../infra/prisma.js';
import { requirePermission } from '../../auth/middleware.js';
import { NotFoundError, ValidationError } from '../../../shared/errors.js';

export function createCatalogRouter(): Router {
  const router = Router();

  // GET /tarifas — Listado oficial de tarifas
  router.get(
    '/tarifas',
    requirePermission('tariffs:read'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tariffs = await prisma.tariff.findMany({
          include: {
            space: {
              include: {
                venue: true,
              },
            },
          },
          orderBy: [
            { space: { name: 'asc' } },
            { purpose: 'asc' },
          ],
        });

        if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
          res.render('pages/tarifas/index.njk', {
            tariffs,
            currentUser: req.session?.user,
            user: req.session?.user,
            csrfToken: (res.locals.csrfToken as string) || '',
          });
          return;
        }

        res.status(200).json({ tariffs });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /tarifas/:id — Actualización de tarifa por el Jefe de Oficina
  router.post(
    '/tarifas/:id',
    requirePermission('tariffs:update'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = String(req.params.id);
        const { amountPesos, pricePesos, effectiveFrom, validFrom } = req.body;

        const rawAmount = pricePesos ?? amountPesos;
        const parsedAmount = parseInt(String(rawAmount), 10);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          throw new ValidationError('El monto de la tarifa debe ser un valor entero positivo mayor a cero');
        }

        const existing = await prisma.tariff.findUnique({ where: { id } });
        if (!existing) {
          throw new NotFoundError(`Tarifa con ID ${id} no encontrada`);
        }

        const updated = await prisma.tariff.update({
          where: { id },
          data: {
            pricePesos: parsedAmount,
            validFrom: validFrom ? new Date(String(validFrom)) : (effectiveFrom ? new Date(String(effectiveFrom)) : new Date()),
            updatedById: req.session?.user?.id ?? null,
          },
        });

        if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
          res.redirect('/tarifas');
          return;
        }

        res.status(200).json({
          message: 'Tarifa actualizada con éxito',
          tariff: updated,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
