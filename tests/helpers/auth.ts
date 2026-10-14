import type { Express } from 'express';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { createUser } from './factories.js';

export interface AuthenticatedAgent {
  agent: ReturnType<typeof request.agent>;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
  csrfToken: string;
}

export async function loginAs(
  app: Express,
  role: UserRole = UserRole.ADMIN_ASSISTANT,
): Promise<AuthenticatedAgent> {
  const user = await createUser(role);
  const agent = request.agent(app);

  const loginPage = await agent.get('/login');
  const match = loginPage.text.match(/name="_csrf" value="([^"]+)"/);
  const csrfToken = match ? match[1] : '';

  await agent.post('/login').send({
    _csrf: csrfToken,
    email: user.email,
    password: 'Cambiar123!',
  });

  return { agent, user, csrfToken };
}
