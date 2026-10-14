import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage } from 'node:http';
import nunjucks from 'nunjucks';
import path from 'node:path';
import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import { env } from './config/env.js';
import { logger } from './shared/logger.js';
import { errorHandler, notFoundHandler } from './shared/middleware/errorHandler.js';
import { doubleCsrfProtection, generateToken } from './modules/auth/csrf.js';
import { createAuthRouter } from './modules/auth/routes.js';
import { createDocumentRouter } from './modules/documents/index.js';
import './modules/auth/types.js';

export interface AppOptions {
  configureRoutes?: (app: express.Application) => void;
}

export function createApp(opts?: AppOptions): express.Application {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
    }),
  );

  // Request ID & HTTP logging
  app.use(
    pinoHttp({
      logger,
      genReqId: (req: IncomingMessage) =>
        (req.headers['x-request-id'] as string) || crypto.randomUUID(),
      autoLogging: env.NODE_ENV !== 'test',
    }),
  );

  // Cookie and body parsing
  app.use(cookieParser(env.SESSION_SECRET));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Session store in PostgreSQL
  const PgStore = connectPgSimple(session);
  const sessionPool = new pg.Pool({
    connectionString:
      env.NODE_ENV === 'test' && env.TEST_DATABASE_URL ? env.TEST_DATABASE_URL : env.DATABASE_URL,
  });

  app.use(
    session({
      store: new PgStore({
        pool: sessionPool,
        tableName: 'session',
        createTableIfMissing: false,
      }),
      name: 'sgec.sid',
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production',
        maxAge: 2 * 60 * 60 * 1000, // 2 hours
      },
    }),
  );

  // Static files
  const publicPath = path.resolve(process.cwd(), 'public');
  app.use(express.static(publicPath));

  // Template engine
  const viewsPath = path.resolve(process.cwd(), 'src/views');
  nunjucks.configure(viewsPath, {
    autoescape: true,
    express: app,
    watch: env.NODE_ENV === 'development',
    noCache: env.NODE_ENV !== 'production',
  });
  app.set('view engine', 'njk');

  // Health check endpoint (exempt from CSRF)
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: env.NODE_ENV,
    });
  });

  // CSRF Protection
  app.use(doubleCsrfProtection);

  // Expose user and CSRF token to views
  app.use((req, res, next) => {
    res.locals.user = req.session?.user || null;
    try {
      res.locals.csrfToken = generateToken(req, res);
    } catch {
      res.locals.csrfToken = '';
    }
    next();
  });

  // Auth routes (/login, /logout)
  app.use(createAuthRouter());

  // Documents routes (/solicitudes/:id/documentos/:kind)
  app.use(createDocumentRouter());

  // Root endpoint
  app.get('/', (req, res) => {
    res.render('layouts/base.njk', {
      title: 'SGEC — Inicio',
      user: req.session?.user || null,
    });
  });

  // Custom routes (e.g. for testing or extensions)
  opts?.configureRoutes?.(app);

  // 404 handler
  app.use(notFoundHandler);

  // Central error handler
  app.use(errorHandler);

  return app;
}
