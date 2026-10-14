import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infra/prisma.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import { requireAuth, requirePermission } from '../../src/modules/auth/middleware.js';

describe('Auth & RBAC Integration', () => {
  const app = createApp({
    configureRoutes: (app) => {
      app.get('/test/protected', requireAuth, (_req, res) => {
        res.json({ secret: 'protected-data' });
      });
      app.get('/test/admin-only', requirePermission('rentals:register'), (_req, res) => {
        res.json({ action: 'registered' });
      });
    },
  });

  let assistantUser: { id: string; email: string };
  let techUser: { id: string; email: string };

  beforeAll(async () => {
    const passwordHash = await hashPassword('Cambiar123!');

    assistantUser = await prisma.user.upsert({
      where: { email: 'test_assistant@sgec.local' },
      update: { passwordHash, active: true },
      create: {
        email: 'test_assistant@sgec.local',
        name: 'Test Assistant',
        passwordHash,
        role: UserRole.ADMIN_ASSISTANT,
        active: true,
      },
    });

    techUser = await prisma.user.upsert({
      where: { email: 'test_tech@sgec.local' },
      update: { passwordHash, active: true },
      create: {
        email: 'test_tech@sgec.local',
        name: 'Test Tech',
        passwordHash,
        role: UserRole.OPERATIONS_TECH,
        active: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { in: ['test_assistant@sgec.local', 'test_tech@sgec.local'] },
      },
    });
  });

  it('GET /login should display login form with CSRF token', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Iniciar sesión');
    expect(res.text).toContain('name="_csrf"');
  });

  it('accessing protected route without session redirects to /login', async () => {
    const res = await request(app).get('/test/protected').set('Accept', 'text/html');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('POST /login with invalid password should fail with 401', async () => {
    const agent = request.agent(app);
    const loginPage = await agent.get('/login');
    const match = loginPage.text.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = match ? match[1] : '';

    const res = await agent.post('/login').send({
      _csrf: csrfToken,
      email: assistantUser.email,
      password: 'WrongPassword123',
    });

    expect(res.status).toBe(401);
    expect(res.text).toContain('Credenciales incorrectas');
  });

  it('login with valid credentials succeeds and allows accessing protected route', async () => {
    const agent = request.agent(app);
    const loginPage = await agent.get('/login');
    const match = loginPage.text.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = match ? match[1] : '';

    const loginRes = await agent.post('/login').send({
      _csrf: csrfToken,
      email: assistantUser.email,
      password: 'Cambiar123!',
    });

    expect(loginRes.status).toBe(302);
    expect(loginRes.headers.location).toBe('/');

    // Access protected route with agent session
    const protectedRes = await agent.get('/test/protected');
    expect(protectedRes.status).toBe(200);
    expect(protectedRes.body.secret).toBe('protected-data');

    // Access route with permission allowed for ADMIN_ASSISTANT
    const permissionRes = await agent.get('/test/admin-only');
    expect(permissionRes.status).toBe(200);
    expect(permissionRes.body.action).toBe('registered');

    // Logout
    const logoutRes = await agent.post('/logout').send({ _csrf: csrfToken });
    expect(logoutRes.status).toBe(302);
    expect(logoutRes.headers.location).toBe('/login');

    // Verify session is cleared
    const afterLogoutRes = await agent.get('/test/protected').set('Accept', 'text/html');
    expect(afterLogoutRes.status).toBe(302);
    expect(afterLogoutRes.headers.location).toBe('/login');
  });

  it('user without required permission receives 403 Forbidden', async () => {
    const agent = request.agent(app);
    const loginPage = await agent.get('/login');
    const match = loginPage.text.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = match ? match[1] : '';

    const loginRes = await agent.post('/login').send({
      _csrf: csrfToken,
      email: techUser.email,
      password: 'Cambiar123!',
    });
    expect(loginRes.status).toBe(302);

    // Attempt to access admin-only route
    const forbiddenRes = await agent.get('/test/admin-only');
    expect(forbiddenRes.status).toBe(403);
  });
});
