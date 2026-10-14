import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { prisma } from '../../../infra/prisma.js';
import { NotFoundError, ValidationError } from '../../../shared/errors.js';
import { RentalContext } from '../domain/states/rentalContext.js';
import {
  TransitionName,
  UserRole as DomainUserRole,
} from '../domain/states/types.js';

export interface GetRentalDetailInput {
  rentalRequestId: string;
  actorRole?: UserRole;
}

export type RentalDetail = Prisma.RentalRequestGetPayload<{
  include: {
    customer: true;
    space: {
      include: {
        venue: true;
      };
    };
    quotedTariff: true;
    reservations: true;
    requestDocuments: {
      include: {
        verifiedBy: {
          select: { id: true; name: true; email: true; role: true };
        };
      };
    };
    contract: {
      include: {
        signedBy: {
          select: { id: true; name: true; email: true; role: true };
        };
      };
    };
    payment: true;
    legalReviews: {
      include: {
        reviewer: {
          select: { id: true; name: true; email: true; role: true };
        };
      };
    };
    generatedDocuments: true;
    stateTransitions: {
      include: {
        actor: {
          select: { id: true; name: true; email: true; role: true };
        };
      };
    };
  };
}>;

export interface GetRentalDetailResult {
  rental: RentalDetail;
  allowedTransitions: TransitionName[];
}

export class GetRentalDetailUseCase {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  public async execute(input: GetRentalDetailInput): Promise<GetRentalDetailResult> {
    const { rentalRequestId, actorRole } = input;

    if (!rentalRequestId) {
      throw new ValidationError('El ID de la solicitud es obligatorio');
    }

    const rental = await this.prismaClient.rentalRequest.findUnique({
      where: { id: rentalRequestId },
      include: {
        customer: true,
        space: {
          include: {
            venue: true,
          },
        },
        quotedTariff: true,
        reservations: {
          orderBy: { startsAt: 'asc' },
        },
        requestDocuments: {
          include: {
            verifiedBy: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        contract: {
          include: {
            signedBy: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        payment: true,
        legalReviews: {
          include: {
            reviewer: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { round: 'asc' },
        },
        generatedDocuments: {
          orderBy: [{ kind: 'asc' }, { version: 'desc' }],
        },
        stateTransitions: {
          include: {
            actor: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { occurredAt: 'asc' },
        },
      },
    });

    if (!rental) {
      throw new NotFoundError(`Solicitud con ID ${rentalRequestId} no encontrada`);
    }

    const context = new RentalContext({
      id: rental.id,
      status: rental.status,
      customerId: rental.customerId,
      spaceId: rental.spaceId,
      eventName: rental.eventName,
      eventDescription: rental.eventDescription,
      purpose: rental.purpose,
      expectedAttendees: rental.expectedAttendees,
      startsAt: rental.startsAt,
      endsAt: rental.endsAt,
      channel: rental.channel,
      requestRadicado: rental.requestRadicado,
      responseRadicado: rental.responseRadicado,
      quotedAmountPesos: rental.quotedAmountPesos,
      quotedTariffId: rental.quotedTariffId,
      cancelReason: rental.cancelReason,
    });

    const allowedTransitions: TransitionName[] = actorRole
      ? (context
          .allowedTransitions()
          .filter((t: TransitionName) => context.can(t, actorRole as DomainUserRole).allowed))
      : context.allowedTransitions();

    return {
      rental,
      allowedTransitions,
    };
  }
}
