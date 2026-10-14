import { describe, it, expect } from 'vitest';
import { UserRole } from '@prisma/client';
import { hasPermission } from '../../src/modules/auth/permissions.js';

describe('RBAC Permissions', () => {
  it('OFFICE_HEAD should be able to view, cancel and update tariffs', () => {
    expect(hasPermission(UserRole.OFFICE_HEAD, 'rentals:read')).toBe(true);
    expect(hasPermission(UserRole.OFFICE_HEAD, 'rentals:cancel')).toBe(true);
    expect(hasPermission(UserRole.OFFICE_HEAD, 'tariffs:update')).toBe(true);
    expect(hasPermission(UserRole.OFFICE_HEAD, 'rentals:sign-number')).toBe(false);
  });

  it('ADMIN_ASSISTANT should have permissions for T1-T6, T9, T11', () => {
    expect(hasPermission(UserRole.ADMIN_ASSISTANT, 'rentals:register')).toBe(true);
    expect(hasPermission(UserRole.ADMIN_ASSISTANT, 'rentals:respond')).toBe(true);
    expect(hasPermission(UserRole.ADMIN_ASSISTANT, 'rentals:verify-docs')).toBe(true);
    expect(hasPermission(UserRole.ADMIN_ASSISTANT, 'rentals:draft-contract')).toBe(true);
    expect(hasPermission(UserRole.ADMIN_ASSISTANT, 'rentals:register-payment')).toBe(true);
    expect(hasPermission(UserRole.ADMIN_ASSISTANT, 'rentals:submit-legal')).toBe(true);
    expect(hasPermission(UserRole.ADMIN_ASSISTANT, 'rentals:resubmit-legal')).toBe(true);
    expect(hasPermission(UserRole.ADMIN_ASSISTANT, 'rentals:cancel')).toBe(true);
    // Should NOT have legal review approval or signing
    expect(hasPermission(UserRole.ADMIN_ASSISTANT, 'rentals:approve-legal')).toBe(false);
    expect(hasPermission(UserRole.ADMIN_ASSISTANT, 'rentals:sign-number')).toBe(false);
    expect(hasPermission(UserRole.ADMIN_ASSISTANT, 'tariffs:update')).toBe(false);
  });

  it('LEGAL should only have legal review permissions and read', () => {
    expect(hasPermission(UserRole.LEGAL, 'rentals:read')).toBe(true);
    expect(hasPermission(UserRole.LEGAL, 'rentals:approve-legal')).toBe(true);
    expect(hasPermission(UserRole.LEGAL, 'rentals:return-legal')).toBe(true);
    expect(hasPermission(UserRole.LEGAL, 'rentals:register')).toBe(false);
    expect(hasPermission(UserRole.LEGAL, 'rentals:sign-number')).toBe(false);
  });

  it('SECRETARY should only have signing permission and read', () => {
    expect(hasPermission(UserRole.SECRETARY, 'rentals:read')).toBe(true);
    expect(hasPermission(UserRole.SECRETARY, 'rentals:sign-number')).toBe(true);
    expect(hasPermission(UserRole.SECRETARY, 'rentals:register')).toBe(false);
    expect(hasPermission(UserRole.SECRETARY, 'rentals:approve-legal')).toBe(false);
  });

  it('OPERATIONS_TECH should only have agenda:read and home:read', () => {
    expect(hasPermission(UserRole.OPERATIONS_TECH, 'home:read')).toBe(true);
    expect(hasPermission(UserRole.OPERATIONS_TECH, 'agenda:read')).toBe(true);
    expect(hasPermission(UserRole.OPERATIONS_TECH, 'rentals:read')).toBe(false);
  });

  it('MAINTENANCE_TECH should only have home:read', () => {
    expect(hasPermission(UserRole.MAINTENANCE_TECH, 'home:read')).toBe(true);
    expect(hasPermission(UserRole.MAINTENANCE_TECH, 'agenda:read')).toBe(false);
    expect(hasPermission(UserRole.MAINTENANCE_TECH, 'rentals:read')).toBe(false);
  });
});
