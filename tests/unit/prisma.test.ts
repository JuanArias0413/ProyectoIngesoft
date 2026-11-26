import { describe, it, expect } from 'vitest';
import { prisma, withAuditCreate, withAuditUpdate } from '../../src/infra/prisma.js';

describe('Prisma Client & Audit Helpers', () => {
  it('prisma client should be instantiated', () => {
    expect(prisma).toBeDefined();
    expect(prisma.user).toBeDefined();
    expect(prisma.reservation).toBeDefined();
  });

  it('withAuditCreate should attach createdById and updatedById', () => {
    const raw = { name: 'Auditorio Principal' };
    const audited = withAuditCreate(raw, 'user-123');

    expect(audited).toEqual({
      name: 'Auditorio Principal',
      createdById: 'user-123',
      updatedById: 'user-123',
    });
  });

  it('withAuditCreate should return unmodified data if userId is undefined', () => {
    const raw = { name: 'Auditorio Principal' };
    const audited = withAuditCreate(raw);

    expect(audited).toEqual(raw);
  });

  it('withAuditUpdate should attach updatedById', () => {
    const raw = { capacity: 250 };
    const audited = withAuditUpdate(raw, 'user-456');

    expect(audited).toEqual({
      capacity: 250,
      updatedById: 'user-456',
    });
  });
});
