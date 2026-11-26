import { UserRole } from '@prisma/client';

export type Permission =
  | 'home:read'
  | 'agenda:read'
  | 'tariffs:read'
  | 'tariffs:update'
  | 'rentals:read'
  | 'rentals:register'
  | 'rentals:respond'
  | 'rentals:verify-docs'
  | 'rentals:draft-contract'
  | 'rentals:register-payment'
  | 'rentals:submit-legal'
  | 'rentals:approve-legal'
  | 'rentals:return-legal'
  | 'rentals:resubmit-legal'
  | 'rentals:sign-number'
  | 'rentals:cancel'
  | 'files:download';

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.OFFICE_HEAD]: [
    'home:read',
    'agenda:read',
    'tariffs:read',
    'tariffs:update',
    'rentals:read',
    'rentals:cancel',
    'files:download',
  ],
  [UserRole.ADMIN_ASSISTANT]: [
    'home:read',
    'agenda:read',
    'tariffs:read',
    'rentals:read',
    'rentals:register',
    'rentals:respond',
    'rentals:verify-docs',
    'rentals:draft-contract',
    'rentals:register-payment',
    'rentals:submit-legal',
    'rentals:resubmit-legal',
    'rentals:cancel',
    'files:download',
  ],
  [UserRole.LEGAL]: [
    'home:read',
    'rentals:read',
    'rentals:approve-legal',
    'rentals:return-legal',
    'files:download',
  ],
  [UserRole.SECRETARY]: [
    'home:read',
    'rentals:read',
    'rentals:sign-number',
    'files:download',
  ],
  [UserRole.OPERATIONS_TECH]: [
    'home:read',
    'agenda:read',
  ],
  [UserRole.MAINTENANCE_TECH]: [
    'home:read',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}
