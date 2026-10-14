import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './controller.js';
import { env } from '../../config/env.js';

export function createAuthRouter(): Router {
  const router = Router();
  const controller = new AuthController();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === 'test' ? 1000 : 10,
    message: { error: 'Demasiados intentos fallidos. Intente de nuevo más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
  });

  router.get('/login', (req, res) => controller.showLogin(req, res));
  router.post('/login', loginLimiter, (req, res, next) => controller.login(req, res, next));
  router.post('/logout', (req, res, next) => controller.logout(req, res, next));

  return router;
}
