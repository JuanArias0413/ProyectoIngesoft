import { describe, it, expect } from 'vitest';
import { env } from '../../src/config/env.js';

describe('Environment config', () => {
  it('should load required env variables correctly', () => {
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.DATABASE_URL).toContain('sgec_dev');
    expect(env.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.PORT).toBe(3000);
  });
});
