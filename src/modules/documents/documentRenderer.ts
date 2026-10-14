import path from 'node:path';
import nunjucks from 'nunjucks';
import { DocumentKind, PrismaClient, PricingUnit } from '@prisma/client';
import { prisma } from '../../infra/prisma.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { calculateRentalPrice } from '../rentals/domain/pricing/pricingCalculator.js';
import type { IDocumentRenderer } from '../rentals/application/IDocumentRenderer.js';
import {
  formatDateLong,
  formatDateTime,
  formatDateRange,
  formatCurrency,
  formatAmountWords,
  formatCustomerType,
  formatPurpose,
  formatPricingUnit,
} from './formatters.js';

export class DocumentRenderer implements IDocumentRenderer {
  private readonly nunjucksEnv: nunjucks.Environment;

  constructor(
    private readonly prismaClient: PrismaClient = prisma,
    templatesDir?: string,
  ) {
    const resolvedDir =
      templatesDir ?? path.resolve(process.cwd(), 'src/modules/documents/templates');

    const loader = new nunjucks.FileSystemLoader(resolvedDir, {
      noCache: process.env.NODE_ENV !== 'production',
    });

    this.nunjucksEnv = new nunjucks.Environment(loader, {
      autoescape: true,
      trimBlocks: true,
      lstripBlocks: true,
    });

    this.nunjucksEnv.addFilter('currency', formatCurrency);
    this.nunjucksEnv.addFilter('amountWords', formatAmountWords);
    this.nunjucksEnv.addFilter('dateLong', formatDateLong);
    this.nunjucksEnv.addFilter('dateTime', formatDateTime);
    this.nunjucksEnv.addFilter('dateRange', formatDateRange);
  }

  /**
   * Genera el oficio de respuesta (RESPONSE_LETTER, versión 1).
   */
  async generateResponseLetter(rentalId: string, actorId?: string): Promise<void> {
    const rental = await this.getRentalWithDetails(rentalId);

    const requirements = await this.prismaClient.documentRequirement.findMany({
      where: { customerType: rental.customer.type },
      orderBy: [{ mandatory: 'desc' }, { code: 'asc' }],
    });

    const { amountPesos } = await this.resolvePricing(rental);
    const generatedById = await this.resolveActorId(rental, actorId);

    const now = new Date();
    const cityAndDate = `Pereira, ${formatDateLong(now)}`;
    const responseRadicado =
      rental.responseRadicado || `RAD-RESP-${rental.id.slice(0, 8).toUpperCase()}`;

    const context = {
      rentalRequestId: rental.id,
      version: 1,
      cityAndDate,
      responseRadicado,
      requestRadicado: rental.requestRadicado,
      customer: {
        name: rental.customer.name,
        typeLabel: formatCustomerType(rental.customer.type),
        documentType: rental.customer.documentType,
        documentNumber: rental.customer.documentNumber,
        legalRepresentative: rental.customer.legalRepresentative,
        address: rental.customer.address,
        email: rental.customer.email,
        phone: rental.customer.phone,
      },
      eventName: rental.eventName,
      eventDescription: rental.eventDescription,
      venue: {
        name: rental.space.venue.name,
        address: rental.space.venue.address,
      },
      space: {
        name: rental.space.name,
        capacity: rental.space.capacity,
      },
      purposeLabel: formatPurpose(rental.purpose),
      formattedDateRange: formatDateRange(rental.startsAt, rental.endsAt),
      requirements: requirements.map((req) => ({
        code: req.code,
        name: req.name,
        mandatory: req.mandatory,
      })),
      formattedAmount: formatCurrency(amountPesos),
      amountInWords: formatAmountWords(amountPesos),
    };

    const html = this.nunjucksEnv.render('responseLetter.njk', context);

    await this.prismaClient.generatedDocument.create({
      data: {
        rentalRequestId: rental.id,
        kind: DocumentKind.RESPONSE_LETTER,
        version: 1,
        html,
        generatedById,
        generatedAt: now,
      },
    });
  }

  /**
   * Genera el estudio previo (PRIOR_STUDY) y el borrador de contrato (CONTRACT) con versión incremental.
   */
  async generatePriorStudyAndContract(
    rentalId: string,
    version?: number,
    actorId?: string,
  ): Promise<void> {
    const rental = await this.getRentalWithDetails(rentalId);
    const { amountPesos, tariff, pricing } = await this.resolvePricing(rental);
    const generatedById = await this.resolveActorId(rental, actorId);

    // Determinar versión incremental si no fue suministrada
    let v = version;
    if (!v || v <= 0) {
      const count = await this.prismaClient.generatedDocument.count({
        where: {
          rentalRequestId: rental.id,
          kind: DocumentKind.PRIOR_STUDY,
        },
      });
      v = count + 1;
    }

    const now = new Date();
    const cityAndDate = `Pereira, ${formatDateLong(now)}`;

    const defaultObject = `Arrendamiento temporal del espacio ${rental.space.name} ubicado en ${rental.space.venue.name} para la realización del evento «${rental.eventName}».`;
    const contractObject = rental.contract?.object || defaultObject;

    const unitPrice = tariff?.pricePesos ?? 0;
    const unitsBilled = pricing?.unitsBilled ?? 1;
    const pricingUnit = tariff?.unit ?? rental.space.pricingUnit;
    const isHourly = pricingUnit === PricingUnit.HOUR;
    const unitsBilledLabel = isHourly
      ? unitsBilled === 1
        ? 'hora'
        : 'horas'
      : unitsBilled === 1
        ? 'día'
        : 'días';

    const calculationFormula = `${unitsBilled} ${unitsBilledLabel} × ${formatCurrency(unitPrice)}`;
    const durationText = isHourly
      ? `${pricing?.durationHours ?? unitsBilled} horas`
      : `${unitsBilled} días`;

    const commonContext = {
      rentalRequestId: rental.id,
      version: v,
      cityAndDate,
      generatedDateLong: formatDateLong(now),
      customer: {
        name: rental.customer.name,
        typeLabel: formatCustomerType(rental.customer.type),
        documentType: rental.customer.documentType,
        documentNumber: rental.customer.documentNumber,
        legalRepresentative: rental.customer.legalRepresentative,
        address: rental.customer.address,
        email: rental.customer.email,
        phone: rental.customer.phone,
      },
      venue: {
        name: rental.space.venue.name,
        address: rental.space.venue.address,
      },
      space: {
        name: rental.space.name,
        capacity: rental.space.capacity,
      },
      eventName: rental.eventName,
      eventDescription: rental.eventDescription,
      contractObject,
      purposeLabel: formatPurpose(rental.purpose),
      formattedDateRange: formatDateRange(rental.startsAt, rental.endsAt),
      startsAtLong: formatDateLong(rental.startsAt),
      endsAtLong: formatDateLong(rental.endsAt),
      durationText,
      formattedAmount: formatCurrency(rental.contract?.valuePesos ?? amountPesos),
      amountInWords: formatAmountWords(rental.contract?.valuePesos ?? amountPesos),
      tariffDetails: {
        pricingUnitLabel: formatPricingUnit(pricingUnit),
        formattedUnitPrice: formatCurrency(unitPrice),
        unitsBilled,
        unitsBilledLabel,
        calculationFormula,
        formattedAmount: formatCurrency(amountPesos),
        amountInWords: formatAmountWords(amountPesos),
      },
      additionalClauses: rental.contract?.additionalClauses || null,
      contractNumber: rental.contract?.number || null,
    };

    // 1. Renderizar y guardar Estudio Previo
    const priorStudyHtml = this.nunjucksEnv.render('priorStudy.njk', commonContext);
    await this.prismaClient.generatedDocument.create({
      data: {
        rentalRequestId: rental.id,
        kind: DocumentKind.PRIOR_STUDY,
        version: v,
        html: priorStudyHtml,
        generatedById,
        generatedAt: now,
      },
    });

    // 2. Renderizar y guardar Contrato borrador
    const contractHtml = this.nunjucksEnv.render('contract.njk', commonContext);
    await this.prismaClient.generatedDocument.create({
      data: {
        rentalRequestId: rental.id,
        kind: DocumentKind.CONTRACT,
        version: v,
        html: contractHtml,
        generatedById,
        generatedAt: now,
      },
    });
  }

  /**
   * Genera el contrato definitivo (CONTRACT, última versión + 1), incluyendo el número asignado.
   */
  async generateFinalContract(rentalId: string, actorId?: string): Promise<void> {
    const rental = await this.getRentalWithDetails(rentalId);
    const { amountPesos } = await this.resolvePricing(rental);
    const generatedById = await this.resolveActorId(rental, actorId);

    const latestDoc = await this.prismaClient.generatedDocument.findFirst({
      where: {
        rentalRequestId: rental.id,
        kind: DocumentKind.CONTRACT,
      },
      orderBy: { version: 'desc' },
    });

    const finalVersion = (latestDoc?.version ?? 0) + 1;
    const now = new Date();

    const contractValue = rental.contract?.valuePesos ?? amountPesos;
    const contractObject =
      rental.contract?.object ||
      `Arrendamiento temporal del espacio ${rental.space.name} ubicado en ${rental.space.venue.name} para la realización del evento «${rental.eventName}».`;

    const signedAt = rental.contract?.signedAt || now;
    const signedAtFormatted = formatDateTime(signedAt);
    const signedByName = rental.contract?.signedBy?.name || 'Secretario de Cultura de Pereira';

    const context = {
      rentalRequestId: rental.id,
      version: finalVersion,
      contractNumber: rental.contract?.number || null,
      generatedDateLong: formatDateLong(now),
      signedAtFormatted,
      signedByName,
      customer: {
        name: rental.customer.name,
        typeLabel: formatCustomerType(rental.customer.type),
        documentType: rental.customer.documentType,
        documentNumber: rental.customer.documentNumber,
        legalRepresentative: rental.customer.legalRepresentative,
        address: rental.customer.address,
        email: rental.customer.email,
        phone: rental.customer.phone,
      },
      venue: {
        name: rental.space.venue.name,
        address: rental.space.venue.address,
      },
      space: {
        name: rental.space.name,
        capacity: rental.space.capacity,
      },
      eventName: rental.eventName,
      eventDescription: rental.eventDescription,
      contractObject,
      formattedDateRange: formatDateRange(rental.startsAt, rental.endsAt),
      startsAtLong: formatDateLong(rental.startsAt),
      endsAtLong: formatDateLong(rental.endsAt),
      formattedAmount: formatCurrency(contractValue),
      amountInWords: formatAmountWords(contractValue),
      additionalClauses: rental.contract?.additionalClauses || null,
    };

    const html = this.nunjucksEnv.render('contract.njk', context);

    await this.prismaClient.generatedDocument.create({
      data: {
        rentalRequestId: rental.id,
        kind: DocumentKind.CONTRACT,
        version: finalVersion,
        html,
        generatedById,
        generatedAt: now,
      },
    });
  }

  // Helpers internos
  private async getRentalWithDetails(rentalId: string) {
    const rental = await this.prismaClient.rentalRequest.findUnique({
      where: { id: rentalId },
      include: {
        customer: true,
        space: {
          include: {
            venue: true,
          },
        },
        quotedTariff: true,
        contract: {
          include: {
            signedBy: true,
          },
        },
        stateTransitions: {
          orderBy: { occurredAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!rental) {
      throw new NotFoundError(`Solicitud de alquiler con ID '${rentalId}' no encontrada`);
    }

    return rental;
  }

  private async resolvePricing(rental: Awaited<ReturnType<typeof this.getRentalWithDetails>>) {
    let tariff = rental.quotedTariff;
    if (!tariff && rental.quotedTariffId) {
      tariff = await this.prismaClient.tariff.findUnique({
        where: { id: rental.quotedTariffId },
      });
    }

    if (!tariff) {
      tariff = await this.prismaClient.tariff.findFirst({
        where: {
          spaceId: rental.spaceId,
          purpose: rental.purpose,
          validFrom: { lte: rental.startsAt },
          OR: [{ validTo: null }, { validTo: { gte: rental.startsAt } }],
        },
      });
    }

    let pricing = null;
    let amountPesos = rental.quotedAmountPesos ?? 0;

    if (tariff) {
      try {
        pricing = calculateRentalPrice({
          startsAt: rental.startsAt,
          endsAt: rental.endsAt,
          tariff,
        });
        if (!amountPesos) {
          amountPesos = pricing.amountPesos;
        }
      } catch {
        // En caso de que el rango sea especial, conservamos el valor cotizado
      }
    }

    return { amountPesos, tariff, pricing };
  }

  private async resolveActorId(
    rental: Awaited<ReturnType<typeof this.getRentalWithDetails>>,
    actorId?: string,
  ): Promise<string> {
    if (actorId) return actorId;
    if (rental.updatedById) return rental.updatedById;
    if (rental.createdById) return rental.createdById;
    if (rental.stateTransitions[0]?.actorId) return rental.stateTransitions[0].actorId;

    const fallbackUser = await this.prismaClient.user.findFirst({
      where: { role: { in: ['ADMIN_ASSISTANT', 'OFFICE_HEAD'] } },
    });
    if (fallbackUser) return fallbackUser.id;

    const anyUser = await this.prismaClient.user.findFirst();
    if (anyUser) return anyUser.id;

    throw new ValidationError(
      'No se encontró un usuario válido para registrar como generador del documento',
    );
  }
}
