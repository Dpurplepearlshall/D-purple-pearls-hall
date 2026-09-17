import { describe, expect, it } from 'vitest';
import { hashPassword, comparePassword } from './auth.js';

describe('password security', () => {
  it('hashes and verifies passwords without storing plaintext', async () => {
    const hash = await hashPassword('a-secure-password');
    expect(hash).not.toContain('a-secure-password');
    expect(await comparePassword('a-secure-password', hash)).toBe(true);
    expect(await comparePassword('wrong-password', hash)).toBe(false);
  });
});
