import { Router } from 'express';
import { requireAuth, requirePermission } from '../../auth/middleware.js';
import { RentalController } from './controller.js';
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
import { rentalUploadMiddleware } from '../infra/fileStorage.js';
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
      new VerifyDocumentsUseCase(prisma),
      new ManageDocumentsUseCase(prisma),
      new DraftContractUseCase(prisma, new DocumentRenderer(prisma)),
      new UpdateContractUseCase(prisma, new DocumentRenderer(prisma)),
      new RegisterPaymentUseCase(prisma),
      new SubmitToLegalUseCase(prisma),
      new ApproveLegalUseCase(prisma),
      new ReturnLegalUseCase(prisma),
      new ResubmitToLegalUseCase(prisma, new DocumentRenderer(prisma)),
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

  // F2.3 — Documentos del cliente y T3 verifyDocuments (CAR-04, AC-04.2 a AC-04.5)
  router.post(
    '/solicitudes/:id/documentos/:code/recibir',
    requireAuth,
    requirePermission('rentals:verify-docs'),
    (req, res, next) => ctrl.markDocumentReceived(req, res, next),
  );

  router.post(
    '/solicitudes/:id/documentos/:code/archivo',
    requireAuth,
    requirePermission('rentals:verify-docs'),
    rentalUploadMiddleware,
    (req, res, next) => ctrl.uploadClientDocument(req, res, next),
  );

  router.post(
    '/solicitudes/:id/documentos-cliente/:code',
    requireAuth,
    requirePermission('rentals:verify-docs'),
    rentalUploadMiddleware,
    (req, res, next) => ctrl.uploadClientDocument(req, res, next),
  );

  router.post(
    '/solicitudes/:id/documentos/:code/verificar',
    requireAuth,
    requirePermission('rentals:verify-docs'),
    (req, res, next) => ctrl.verifyDocument(req, res, next),
  );

  router.post(
    '/solicitudes/:id/transiciones/verifyDocuments',
    requireAuth,
    requirePermission('rentals:verify-docs'),
    (req, res, next) => ctrl.verifyDocumentsTransition(req, res, next),
  );

  router.post(
    '/solicitudes/:id/verificar-documentos',
    requireAuth,
    requirePermission('rentals:verify-docs'),
    (req, res, next) => ctrl.verifyDocumentsTransition(req, res, next),
  );

  // F2.4 — T4 draftContract + edición de objeto/cláusulas + versiones (CAR-05, AC-05.1 a AC-05.3)
  router.post(
    '/solicitudes/:id/transiciones/draftContract',
    requireAuth,
    requirePermission('rentals:draft-contract'),
    (req, res, next) => ctrl.draftContract(req, res, next),
  );
  router.post(
    '/solicitudes/:id/elaborar-contrato',
    requireAuth,
    requirePermission('rentals:draft-contract'),
    (req, res, next) => ctrl.draftContract(req, res, next),
  );

  router.patch(
    '/solicitudes/:id/contrato',
    requireAuth,
    requirePermission('rentals:draft-contract'),
    (req, res, next) => ctrl.updateContract(req, res, next),
  );
  router.post(
    '/solicitudes/:id/contrato',
    requireAuth,
    requirePermission('rentals:draft-contract'),
    (req, res, next) => ctrl.updateContract(req, res, next),
  );

  // F2.5 — T5 registerPayment + T6 submitToLegal (CAR-06, AC-06.1 a AC-06.3)
  router.post(
    '/solicitudes/:id/transiciones/registerPayment',
    requireAuth,
    requirePermission('rentals:register-payment'),
    rentalUploadMiddleware,
    (req, res, next) => ctrl.registerPayment(req, res, next),
  );
  router.post(
    '/solicitudes/:id/registrar-pago',
    requireAuth,
    requirePermission('rentals:register-payment'),
    rentalUploadMiddleware,
    (req, res, next) => ctrl.registerPayment(req, res, next),
  );

  router.post(
    '/solicitudes/:id/transiciones/submitToLegal',
    requireAuth,
    requirePermission('rentals:submit-legal'),
    (req, res, next) => ctrl.submitToLegal(req, res, next),
  );
  router.post(
    '/solicitudes/:id/enviar-juridica',
    requireAuth,
    requirePermission('rentals:submit-legal'),
    (req, res, next) => ctrl.submitToLegal(req, res, next),
  );

  // F2.6 — T7 approveLegal, T8 returnLegal, T9 resubmitToLegal (CAR-07, AC-07.1 a AC-07.4)
  router.post(
    '/solicitudes/:id/transiciones/approveLegal',
    requireAuth,
    requirePermission('rentals:approve-legal'),
    (req, res, next) => ctrl.approveLegal(req, res, next),
  );
  router.post(
    '/solicitudes/:id/aprobar-juridica',
    requireAuth,
    requirePermission('rentals:approve-legal'),
    (req, res, next) => ctrl.approveLegal(req, res, next),
  );

  router.post(
    '/solicitudes/:id/transiciones/returnLegal',
    requireAuth,
    requirePermission('rentals:return-legal'),
    (req, res, next) => ctrl.returnLegal(req, res, next),
  );
  router.post(
    '/solicitudes/:id/devolver-juridica',
    requireAuth,
    requirePermission('rentals:return-legal'),
    (req, res, next) => ctrl.returnLegal(req, res, next),
  );

  router.post(
    '/solicitudes/:id/transiciones/resubmitToLegal',
    requireAuth,
    requirePermission('rentals:resubmit-legal'),
    (req, res, next) => ctrl.resubmitToLegal(req, res, next),
  );
  router.post(
    '/solicitudes/:id/reenviar-juridica',
    requireAuth,
    requirePermission('rentals:resubmit-legal'),
    (req, res, next) => ctrl.resubmitToLegal(req, res, next),
  );

  // Descarga autenticada de archivos
  router.get(
    '/archivos/:key',
    requireAuth,
    requirePermission('files:download'),
    (req, res, next) => ctrl.downloadFile(req, res, next),
  );

  return router;
}
