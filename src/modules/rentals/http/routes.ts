import { Router } from 'express';
import { requireAuth, requirePermission } from '../../auth/middleware.js';
import { RentalController } from './controller.js';
import { RegisterRentalUseCase } from '../application/registerRentalUseCase.js';
import { RespondRentalUseCase } from '../application/respondRentalUseCase.js';
import { AvailabilityService } from '../../agenda/application/availabilityService.js';
import { PrismaReservationRepository } from '../../agenda/infra/prismaReservationRepository.js';
import { PrismaTariffRepository } from '../../catalog/infra/prismaCatalogRepositories.js';
import { DocumentRenderer } from '../../documents/documentRenderer.js';
import { prisma } from '../../../infra/prisma.js';

export function createRentalRouter(controller?: RentalController): Router {
  const router = Router();

  const ctrl =
    controller ??
    new RentalController(
      new RegisterRentalUseCase(
        new AvailabilityService(new PrismaReservationRepository(prisma)),
        prisma,
      ),
      new RespondRentalUseCase(
        new PrismaTariffRepository(prisma),
        new DocumentRenderer(prisma),
        prisma,
      ),
    );

  // F2.1 — Registrar solicitud (CAR-01, AC-01.x)
  router.post(
    '/solicitudes',
    requireAuth,
    requirePermission('rentals:register'),
    (req, res, next) => ctrl.register(req, res, next),
  );

  // F2.2 — Responder solicitud (CAR-03, AC-03.1, 03.3)
  router.post(
    '/solicitudes/:id/transiciones/respond',
    requireAuth,
    requirePermission('rentals:respond'),
    (req, res, next) => ctrl.respond(req, res, next),
  );
  router.post(
    '/solicitudes/:id/responder',
    requireAuth,
    requirePermission('rentals:respond'),
    (req, res, next) => ctrl.respond(req, res, next),
  );

  return router;
}
