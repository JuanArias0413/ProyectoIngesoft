import { Router } from 'express';
import { requireAuth, requirePermission } from '../../auth/middleware.js';
import { RentalController } from './controller.js';
import { RegisterRentalUseCase } from '../application/registerRentalUseCase.js';
import { AvailabilityService } from '../../agenda/application/availabilityService.js';
import { PrismaReservationRepository } from '../../agenda/infra/prismaReservationRepository.js';

import { prisma } from '../../../infra/prisma.js';

export function createRentalRouter(controller?: RentalController): Router {
  const router = Router();

  const ctrl =
    controller ??
    new RentalController(
      new RegisterRentalUseCase(
        new AvailabilityService(new PrismaReservationRepository(prisma)),
      ),
    );

  // F2.1 — Registrar solicitud (CAR-01, AC-01.x)
  router.post(
    '/solicitudes',
    requireAuth,
    requirePermission('rentals:register'),
    (req, res, next) => ctrl.register(req, res, next),
  );

  return router;
}
