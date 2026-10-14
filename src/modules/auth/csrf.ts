import { doubleCsrf } from 'csrf-csrf';
import { env } from '../../config/env.js';

export const {
  invalidCsrfTokenError,
  generateToken,
  validateRequest,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => env.SESSION_SECRET,
  cookieName: 'sgec.x-csrf-token',
  cookieOptions: {
    sameSite: 'lax',
    path: '/',
    secure: env.NODE_ENV === 'production',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => {
    return (
      (req.body && typeof req.body === 'object' && '_csrf' in req.body ? req.body._csrf : undefined) ||
      (req.headers['x-csrf-token'] as string | undefined)
    );
  },
});
