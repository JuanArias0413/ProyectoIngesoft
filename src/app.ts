import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage } from 'node:http';
import nunjucks from 'nunjucks';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from './config/env.js';
import { logger } from './shared/logger.js';
import { errorHandler, notFoundHandler } from './shared/middleware/errorHandler.js';

export function createApp(): express.Application {
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

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: env.NODE_ENV,
    });
  });

  // Root endpoint placeholder (for F0.4)
  app.get('/', (_req, res) => {
    res.render('layouts/base.njk', {
      title: 'SGEC — Inicio',
      user: null,
    });
  });

  // 404 handler
  app.use(notFoundHandler);

  // Central error handler
  app.use(errorHandler);

  return app;
}
