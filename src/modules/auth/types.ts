import type { UserRole } from '@prisma/client';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}
