import { prisma } from '../../../src/infra/prisma.js';

export async function cleanupE2ERentals(): Promise<void> {
  const e2eRentals = await prisma.rentalRequest.findMany({
    where: {
      OR: [
        { requestRadicado: { startsWith: 'SAIA-2027-E2E' } },
        { customer: { documentNumber: { in: ['901889900-1', '901776655-2', '901665544-3', '901554433-4'] } } },
      ],
    },
    select: { id: true, customerId: true },
  });

  if (e2eRentals.length === 0) return;

  const rentalIds = e2eRentals.map((r) => r.id);
  const customerIds = e2eRentals.map((r) => r.customerId);

  await prisma.$transaction(async (tx) => {
    await tx.stateTransition.deleteMany({ where: { rentalRequestId: { in: rentalIds } } });
    await tx.requestDocument.deleteMany({ where: { rentalRequestId: { in: rentalIds } } });
    await tx.legalReview.deleteMany({ where: { rentalRequestId: { in: rentalIds } } });
    await tx.generatedDocument.deleteMany({ where: { rentalRequestId: { in: rentalIds } } });
    await tx.payment.deleteMany({ where: { rentalRequestId: { in: rentalIds } } });
    await tx.contract.deleteMany({ where: { rentalRequestId: { in: rentalIds } } });
    await tx.reservation.deleteMany({ where: { rentalRequestId: { in: rentalIds } } });
    await tx.rentalRequest.deleteMany({ where: { id: { in: rentalIds } } });
    await tx.customer.deleteMany({ where: { id: { in: customerIds } } });
  });
}
