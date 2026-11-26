import type { Request, Response, NextFunction } from 'express';

export type FlashType = 'success' | 'error' | 'info' | 'warning';

declare module 'express-session' {
  interface SessionData {
    flash?: Record<FlashType, string[]>;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    flash(type: FlashType, message: string): void;
  }
}

export function flashMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.flash = (type: FlashType, message: string) => {
    if (!req.session) return;
    if (!req.session.flash) {
      req.session.flash = { success: [], error: [], info: [], warning: [] };
    }
    if (!req.session.flash[type]) {
      req.session.flash[type] = [];
    }
    req.session.flash[type].push(message);
  };

  if (req.session && req.session.flash) {
    res.locals.flash = { ...req.session.flash };
    req.session.flash = { success: [], error: [], info: [], warning: [] };
  } else {
    res.locals.flash = { success: [], error: [], info: [], warning: [] };
  }

  next();
}
