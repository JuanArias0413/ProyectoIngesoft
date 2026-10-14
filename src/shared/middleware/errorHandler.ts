import type { Request, Response, NextFunction } from 'express';
import { DomainError, NotFoundError } from '../errors.js';
import { logger } from '../logger.js';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError('La página o recurso solicitado no existe'));
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let message = 'Ha ocurrido un error inesperado en el servidor';
  let details: unknown = undefined;

  if (err instanceof DomainError) {
    statusCode = err.statusCode;
    message = err.message;
    if ('errors' in err) {
      details = (err as { errors: unknown }).errors;
    }
  } else if (err instanceof Error) {
    logger.error({ err, reqId: req.id, url: req.url }, 'Unhandled error');
  } else {
    logger.error({ err, reqId: req.id, url: req.url }, 'Unknown error thrown');
  }

  // Check if response has already been sent
  if (res.headersSent) {
    return;
  }

  const isHtml = req.accepts('html') && !req.xhr && !req.path.startsWith('/api') && !req.path.startsWith('/health');

  if (isHtml) {
    let template = 'errors/500.njk';
    if (statusCode === 403) template = 'errors/403.njk';
    else if (statusCode === 404) template = 'errors/404.njk';

    res.status(statusCode).render(template, {
      title: `Error ${statusCode}`,
      statusCode,
      message,
      reqId: req.id,
    });
    return;
  }

  res.status(statusCode).json({
    error: message,
    statusCode,
    ...(details ? { details } : {}),
  });
}
