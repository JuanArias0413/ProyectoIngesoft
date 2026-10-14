import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: env.NODE_ENV === 'test' && env.TEST_DATABASE_URL ? env.TEST_DATABASE_URL : env.DATABASE_URL,
      },
    },
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Helper to inject createdById and updatedById on record creation
 */
export function withAuditCreate<T extends object>(
  data: T,
  userId?: string | null,
): T & { createdById?: string; updatedById?: string } {
  if (!userId) return data;
  return {
    ...data,
    createdById: userId,
    updatedById: userId,
  };
}

/**
 * Helper to inject updatedById on record update
 */
export function withAuditUpdate<T extends object>(
  data: T,
  userId?: string | null,
): T & { updatedById?: string } {
  if (!userId) return data;
  return {
    ...data,
    updatedById: userId,
  };
}

export type AuditedPrismaClient = typeof prisma;
