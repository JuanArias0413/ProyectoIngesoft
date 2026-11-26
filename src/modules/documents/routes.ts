import { Router, type Request, type Response } from 'express';
import { DocumentKind } from '@prisma/client';
import { prisma } from '../../infra/prisma.js';
import { requirePermission } from '../auth/middleware.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';

export function normalizeDocumentKind(rawKind: string): DocumentKind | null {
  const normalized = rawKind.toUpperCase().replace(/-/g, '_');
  if (
    normalized === 'RESPONSE_LETTER' ||
    normalized === 'OFICIO' ||
    normalized === 'OFICIO_RESPUESTA'
  ) {
    return DocumentKind.RESPONSE_LETTER;
  }
  if (
    normalized === 'PRIOR_STUDY' ||
    normalized === 'ESTUDIO_PREVIO' ||
    normalized === 'ESTUDIO'
  ) {
    return DocumentKind.PRIOR_STUDY;
  }
  if (normalized === 'CONTRACT' || normalized === 'CONTRATO') {
    return DocumentKind.CONTRACT;
  }
  return null;
}

export function createDocumentRouter(): Router {
  const router = Router();

  /**
   * GET /solicitudes/:id/documentos/:kind
   * Requiere sesión y permiso 'rentals:read'.
   * Recupera el GeneratedDocument más reciente (o versión indicada) del tipo dado y lo renderiza.
   */
  router.get(
    '/solicitudes/:id/documentos/:kind',
    requirePermission('rentals:read'),
    async (req: Request, res: Response): Promise<void> => {
      const id = String(req.params.id);
      const kind = String(req.params.kind);

      const documentKind = normalizeDocumentKind(kind);
      if (!documentKind) {
        throw new ValidationError(
          `Tipo de documento no válido: '${kind}'. Los tipos permitidos son RESPONSE_LETTER, PRIOR_STUDY, CONTRACT`,
        );
      }

      const versionQuery = req.query.version
        ? parseInt(String(req.query.version), 10)
        : undefined;

      const document = await prisma.generatedDocument.findFirst({
        where: {
          rentalRequestId: id,
          kind: documentKind,
          ...(versionQuery ? { version: versionQuery } : {}),
        },
        orderBy: {
          version: 'desc',
        },
      });

      if (!document) {
        throw new NotFoundError(
          `No se encontró un documento generado de tipo '${documentKind}' para la solicitud solicitada`,
        );
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(document.html);
    },
  );

  return router;
}
