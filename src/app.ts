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
import { createRentalRouter } from './modules/rentals/http/routes.js';
import { createAgendaRouter } from './modules/agenda/http/routes.js';
import { createCatalogRouter } from './modules/catalog/http/routes.js';
import { RentalStatus } from '@prisma/client';
import { prisma } from './infra/prisma.js';
import { formatBogotaDateTimeCompact } from './shared/utils/formatters.js';
import { flashMiddleware } from './shared/middleware/flash.js';
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

  // Flash messages middleware
  app.use(flashMiddleware);

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

  // Rental routes (/solicitudes, /archivos)
  app.use(createRentalRouter());

  // Agenda routes (/agenda, /agenda/disponibilidad)
  app.use(createAgendaRouter());

  // Catalog / Tariffs routes (/tarifas)
  app.use(createCatalogRouter());

  // Root endpoint con resumen de "pendientes para mí" y métricas
  app.get('/', async (req, res, next) => {
    try {
      const user = req.session?.user;
      if (!user) {
        res.render('pages/home/index.njk', {
          title: 'SGEC — Inicio',
          activeUser: null,
          currentUser: null,
          user: null,
        });
        return;
      }

      // Calcular métricas
      const [totalActive, legalized, cancelled] = await Promise.all([
        prisma.rentalRequest.count({
          where: { status: { notIn: ['LEGALIZED', 'CANCELLED'] } },
        }),
        prisma.rentalRequest.count({
          where: { status: 'LEGALIZED' },
        }),
        prisma.rentalRequest.count({
          where: { status: 'CANCELLED' },
        }),
      ]);

      const stats = {
        totalActive,
        inProgress: totalActive,
        legalized,
        cancelled,
      };

      // Obtener solicitudes pendientes según rol del usuario
      let statusFilter: RentalStatus[] = [];
      if (user.role === 'ADMIN_ASSISTANT') {
        statusFilter = [
          RentalStatus.REGISTERED,
          RentalStatus.RESPONDED,
          RentalStatus.DOCUMENTS_VERIFIED,
          RentalStatus.CONTRACT_DRAFTED,
          RentalStatus.PAID,
          RentalStatus.RETURNED_BY_LEGAL,
        ];
      } else if (user.role === 'LEGAL') {
        statusFilter = [RentalStatus.LEGAL_REVIEW];
      } else if (user.role === 'SECRETARY') {
        statusFilter = [RentalStatus.PENDING_SIGNATURE];
      } else if (user.role === 'OFFICE_HEAD') {
        statusFilter = [
          RentalStatus.REGISTERED,
          RentalStatus.LEGAL_REVIEW,
          RentalStatus.PENDING_SIGNATURE,
        ];
      }

      const pendingList = statusFilter.length > 0
        ? await prisma.rentalRequest.findMany({
            where: { status: { in: statusFilter } },
            include: {
              customer: true,
              space: { include: { venue: true } },
              contract: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          })
        : [];

      const formattedPending = pendingList.map((item) => ({
        ...item,
        startsAtFormatted: formatBogotaDateTimeCompact(item.startsAt),
        customerName: item.customer?.name,
        customerDocument: item.customer?.documentNumber,
        spaceName: item.space?.name,
      }));

      res.render('pages/home/index.njk', {
        title: 'SGEC — Inicio',
        stats,
        pendingRequests: formattedPending,
        pendientes: formattedPending,
        currentUser: user,
        user,
      });
    } catch (error) {
      next(error);
    }
  });

  // Custom routes (e.g. for testing or extensions)
  opts?.configureRoutes?.(app);

  // 404 handler
  app.use(notFoundHandler);

  // Central error handler
  app.use(errorHandler);

  return app;
}
