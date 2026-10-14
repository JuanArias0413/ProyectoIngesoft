import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../../../infra/prisma.js';
import { requirePermission } from '../../auth/middleware.js';
import { AvailabilityService } from '../application/availabilityService.js';
import { PrismaReservationRepository } from '../infra/prismaReservationRepository.js';

export function createAgendaRouter(): Router {
  const router = Router();
  const availabilityService = new AvailabilityService(new PrismaReservationRepository(prisma));

  // GET /agenda — Vista de programación a 30 días
  router.get(
    '/agenda',
    requirePermission('agenda:read'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const venueId = req.query.venueId ? String(req.query.venueId) : undefined;
        const fromQuery = req.query.from ? new Date(String(req.query.from)) : new Date();
        const fromDate = isNaN(fromQuery.getTime()) ? new Date() : fromQuery;
        const toDate = new Date(fromDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        const [venues, reservations] = await Promise.all([
          prisma.venue.findMany({ orderBy: { name: 'asc' } }),
          prisma.reservation.findMany({
            where: {
              status: { in: ['HELD', 'CONFIRMED'] },
              startsAt: { lte: toDate },
              endsAt: { gte: fromDate },
              ...(venueId ? { space: { venueId } } : {}),
            },
            include: {
              space: {
                include: {
                  venue: true,
                },
              },
              rentalRequest: {
                include: {
                  customer: true,
                },
              },
            },
            orderBy: { startsAt: 'asc' },
          }),
        ]);

        const formattedReservations = reservations.map((r) => ({
          ...r,
          startsAtFormatted: r.startsAt ? new Date(r.startsAt).toLocaleString('es-CO') : '',
          endsAtFormatted: r.endsAt ? new Date(r.endsAt).toLocaleString('es-CO') : '',
        }));

        if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
          res.render('pages/agenda/index.njk', {
            reservations: formattedReservations,
            venues,
            selectedVenueId: venueId || '',
            fromDate: req.query.from || '',
            currentUser: req.session?.user,
            user: req.session?.user,
          });
          return;
        }

        res.status(200).json({
          reservations: formattedReservations,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /agenda/disponibilidad — Consulta en tiempo real (HTMX / JSON)
  router.get(
    '/agenda/disponibilidad',
    requirePermission('agenda:read'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { spaceId, startsAt, endsAt } = req.query;

        if (!spaceId || !startsAt || !endsAt) {
          if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
            res.render('pages/agenda/_disponibilidad.njk', {
              incomplete: true,
              spaceId: spaceId ? String(spaceId) : '',
              startsAt: startsAt ? String(startsAt) : '',
              endsAt: endsAt ? String(endsAt) : '',
            });
            return;
          }
          res.status(200).json({ incomplete: true });
          return;
        }

        const startDate = new Date(String(startsAt));
        const endDate = new Date(String(endsAt));

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
          if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
            res.render('pages/agenda/_disponibilidad.njk', {
              incomplete: false,
              available: false,
              message: 'Las fechas seleccionadas no son válidas o la fecha de fin no es posterior a la de inicio.',
              spaceId: String(spaceId),
              startsAt: String(startsAt),
              endsAt: String(endsAt),
            });
            return;
          }
          res.status(400).json({
            available: false,
            error: 'Fechas inválidas',
          });
          return;
        }

        const check = await availabilityService.checkAvailability({
          spaceId: String(spaceId),
          startsAt: startDate,
          endsAt: endDate,
          enforceDurationLimits: false,
        });

        if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
          res.render('pages/agenda/_disponibilidad.njk', {
            incomplete: false,
            available: check.available,
            conflict: check.conflictingReservation
              ? {
                  ...check.conflictingReservation,
                  startsAtFormatted: new Date(check.conflictingReservation.startsAt).toLocaleString('es-CO'),
                  endsAtFormatted: new Date(check.conflictingReservation.endsAt).toLocaleString('es-CO'),
                }
              : null,
            spaceId: String(spaceId),
            startsAt: String(startsAt),
            endsAt: String(endsAt),
          });
          return;
        }

        res.status(200).json(check);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
