import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

describe('App & Health Integration', () => {
  const app = createApp();

  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /nonexistent returns 404 html page', async () => {
    const res = await request(app).get('/nonexistent-page').set('Accept', 'text/html');
    expect(res.status).toBe(404);
    expect(res.text).toContain('404');
    expect(res.text).toContain('Página no encontrada');
  });

  it('GET /nonexistent returns 404 json when accepting json', async () => {
    const res = await request(app).get('/api/nonexistent').set('Accept', 'application/json');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.statusCode).toBe(404);
  });
});
