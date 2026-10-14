import { type PrismaClient } from '@prisma/client';
import { prisma } from './infra/prisma.js';
import { DocumentRenderer } from './modules/documents/documentRenderer.js';
import type { IDocumentRenderer } from './modules/rentals/application/IDocumentRenderer.js';
import { AvailabilityService } from './modules/agenda/application/availabilityService.js';
import { PrismaReservationRepository } from './modules/agenda/infra/prismaReservationRepository.js';
import { PrismaTariffRepository } from './modules/catalog/infra/prismaCatalogRepositories.js';
import { RegisterRentalUseCase } from './modules/rentals/application/registerRentalUseCase.js';
import { RespondRentalUseCase } from './modules/rentals/application/respondRentalUseCase.js';
import { VerifyDocumentsUseCase } from './modules/rentals/application/verifyDocumentsUseCase.js';
import { ManageDocumentsUseCase } from './modules/rentals/application/manageDocumentsUseCase.js';
import { DraftContractUseCase } from './modules/rentals/application/draftContractUseCase.js';
import { UpdateContractUseCase } from './modules/rentals/application/updateContractUseCase.js';
import { RegisterPaymentUseCase } from './modules/rentals/application/registerPaymentUseCase.js';
import { SubmitToLegalUseCase } from './modules/rentals/application/submitToLegalUseCase.js';
import { ApproveLegalUseCase } from './modules/rentals/application/approveLegalUseCase.js';
import { ReturnLegalUseCase } from './modules/rentals/application/returnLegalUseCase.js';
import { ResubmitToLegalUseCase } from './modules/rentals/application/resubmitToLegalUseCase.js';
import { SignAndNumberUseCase } from './modules/rentals/application/signAndNumberUseCase.js';
import { CancelRentalUseCase } from './modules/rentals/application/cancelRentalUseCase.js';
import { ListRentalsUseCase } from './modules/rentals/application/listRentalsUseCase.js';
import { GetRentalDetailUseCase } from './modules/rentals/application/getRentalDetailUseCase.js';
import { RentalController } from './modules/rentals/http/controller.js';

export interface RentalUseCases {
  registerRental: RegisterRentalUseCase;
  respondRental: RespondRentalUseCase;
  verifyDocuments: VerifyDocumentsUseCase;
  manageDocuments: ManageDocumentsUseCase;
  draftContract: DraftContractUseCase;
  updateContract: UpdateContractUseCase;
  registerPayment: RegisterPaymentUseCase;
  submitToLegal: SubmitToLegalUseCase;
  approveLegal: ApproveLegalUseCase;
  returnLegal: ReturnLegalUseCase;
  resubmitToLegal: ResubmitToLegalUseCase;
  signAndNumber: SignAndNumberUseCase;
  cancelRental: CancelRentalUseCase;
  listRentals: ListRentalsUseCase;
  getRentalDetail: GetRentalDetailUseCase;
}

export interface AppContainer {
  prisma: PrismaClient;
  documentRenderer: IDocumentRenderer;
  reservationRepository: PrismaReservationRepository;
  availabilityService: AvailabilityService;
  tariffRepository: PrismaTariffRepository;
  rentalUseCases: RentalUseCases;
  rentalController: RentalController;
}

export function createContainer(): AppContainer {
  const reservationRepository = new PrismaReservationRepository(prisma);
  const availabilityService = new AvailabilityService(reservationRepository);
  const tariffRepository = new PrismaTariffRepository(prisma);
  const documentRenderer = new DocumentRenderer(prisma);

  const rentalUseCases: RentalUseCases = {
    registerRental: new RegisterRentalUseCase(availabilityService, prisma),
    respondRental: new RespondRentalUseCase(tariffRepository, documentRenderer, prisma),
    verifyDocuments: new VerifyDocumentsUseCase(prisma),
    manageDocuments: new ManageDocumentsUseCase(prisma),
    draftContract: new DraftContractUseCase(prisma, documentRenderer),
    updateContract: new UpdateContractUseCase(prisma, documentRenderer),
    registerPayment: new RegisterPaymentUseCase(prisma),
    submitToLegal: new SubmitToLegalUseCase(prisma),
    approveLegal: new ApproveLegalUseCase(prisma),
    returnLegal: new ReturnLegalUseCase(prisma),
    resubmitToLegal: new ResubmitToLegalUseCase(prisma, documentRenderer),
    signAndNumber: new SignAndNumberUseCase(prisma, documentRenderer),
    cancelRental: new CancelRentalUseCase(prisma),
    listRentals: new ListRentalsUseCase(prisma),
    getRentalDetail: new GetRentalDetailUseCase(prisma),
  };

  const rentalController = new RentalController(
    rentalUseCases.registerRental,
    rentalUseCases.respondRental,
    rentalUseCases.verifyDocuments,
    rentalUseCases.manageDocuments,
    rentalUseCases.draftContract,
    rentalUseCases.updateContract,
    rentalUseCases.registerPayment,
    rentalUseCases.submitToLegal,
    rentalUseCases.approveLegal,
    rentalUseCases.returnLegal,
    rentalUseCases.resubmitToLegal,
    rentalUseCases.signAndNumber,
    rentalUseCases.cancelRental,
    rentalUseCases.listRentals,
    rentalUseCases.getRentalDetail,
    prisma,
  );

  return {
    prisma,
    documentRenderer,
    reservationRepository,
    availabilityService,
    tariffRepository,
    rentalUseCases,
    rentalController,
  };
}

export const container = createContainer();
