import { describe, expect, it } from 'vitest';
import { hashPassword, comparePassword } from './auth.js';
import { resultSchema } from './validation.js';

describe('password security', () => {
  it('hashes and verifies passwords without storing plaintext', async () => {
    const hash = await hashPassword('a-secure-password');
    expect(hash).not.toContain('a-secure-password');
    expect(await comparePassword('a-secure-password', hash)).toBe(true);
    expect(await comparePassword('wrong-password', hash)).toBe(false);
  });

  describe('result validation', () => {
    it('requires a current class when uploading a term result', () => {
      const result = resultSchema.safeParse({
        studentAdmissionNumber: 'ST-001',
        term: 'Term 1',
        subject: 'Mathematics',
        score: 85
      });
      expect(result.success).toBe(false);
    });

    it('accepts a class and constrains scores to 100', () => {
      const result = resultSchema.parse({
        studentAdmissionNumber: 'ST-001',
        className: 'JSS 2A',
        term: 'Term 1',
        subject: 'Mathematics',
        score: 85
      });
      expect(result.className).toBe('JSS 2A');
      expect(() => resultSchema.parse({ ...result, score: 101 })).toThrow();
    });
  });
});
