import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../../shared/errors.js';
import { hasPermission, type Permission } from './permissions.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.user) {
    return next();
  }

  const isHtml = req.accepts('html') && !req.xhr && !req.path.startsWith('/api');
  if (isHtml) {
    return res.redirect('/login');
  }

  res.status(401).json({
    error: 'No autenticado: inicie sesión para continuar',
    statusCode: 401,
  });
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session?.user) {
      const isHtml = req.accepts('html') && !req.xhr && !req.path.startsWith('/api');
      if (isHtml) {
        return res.redirect('/login');
      }
      res.status(401).json({
        error: 'No autenticado: inicie sesión para continuar',
        statusCode: 401,
      });
      return;
    }

    if (!hasPermission(req.session.user.role, permission)) {
      return next(
        new ForbiddenError(
          `Acceso denegado: el rol '${req.session.user.role}' no cuenta con el permiso '${permission}'`,
        ),
      );
    }

    next();
  };
}
