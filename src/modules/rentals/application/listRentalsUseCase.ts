import { Prisma, PrismaClient, RentalStatus } from '@prisma/client';
import { prisma } from '../../../infra/prisma.js';

export interface ListRentalsInput {
  status?: RentalStatus;
  search?: string;
  spaceId?: string;
  page?: number;
  pageSize?: number;
}

export type RentalListItem = Prisma.RentalRequestGetPayload<{
  include: {
    customer: true;
    space: {
      include: {
        venue: true;
      };
    };
    contract: true;
    quotedTariff: true;
  };
}>;

export interface ListRentalsResult {
  items: RentalListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
    prevPage: number;
    nextPage: number;
  };
}

export class ListRentalsUseCase {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  public async execute(input: ListRentalsInput = {}): Promise<ListRentalsResult> {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, input.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.RentalRequestWhereInput = {};

    if (input.status) {
      where.status = input.status;
    }

    if (input.spaceId) {
      where.spaceId = input.spaceId;
    }

    const term = input.search?.trim();
    if (term) {
      where.OR = [
        { eventName: { contains: term, mode: 'insensitive' } },
        { requestRadicado: { contains: term, mode: 'insensitive' } },
        { responseRadicado: { contains: term, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { documentNumber: { contains: term, mode: 'insensitive' } },
            ],
          },
        },
        {
          contract: {
            number: { contains: term, mode: 'insensitive' },
          },
        },
      ];
    }

    const [totalItems, items] = await Promise.all([
      this.prismaClient.rentalRequest.count({ where }),
      this.prismaClient.rentalRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          space: {
            include: {
              venue: true,
            },
          },
          contract: true,
          quotedTariff: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
        prevPage: page - 1,
        nextPage: page + 1,
      },
    };
  }
}
