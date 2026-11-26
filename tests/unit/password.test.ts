import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/modules/auth/password.js';

describe('Password Hashing Utility', () => {
  it('hashes and verifies password correctly', async () => {
    const raw = 'Cambiar123!';
    const hash = await hashPassword(raw);

    expect(hash).not.toBe(raw);
    expect(hash.startsWith('$2')).toBe(true);

    const valid = await verifyPassword(raw, hash);
    expect(valid).toBe(true);

    const invalid = await verifyPassword('WrongPassword', hash);
    expect(invalid).toBe(false);
  });
});
