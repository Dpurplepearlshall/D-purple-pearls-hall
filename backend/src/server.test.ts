import { describe, expect, it } from 'vitest';
import { hashPassword, comparePassword } from './auth.js';
import { ownerPasswordResetSchema, resultSchema, selfServicePasswordResetSchema, studentSchema } from './validation.js';

describe('password security', () => {
  it('hashes and verifies passwords without storing plaintext', async () => {
    const hash = await hashPassword('a-secure-password');
    expect(hash).not.toContain('a-secure-password');
    expect(await comparePassword('a-secure-password', hash)).toBe(true);
    expect(await comparePassword('wrong-password', hash)).toBe(false);
  });

  it('validates owner password resets for school accounts only', () => {
    expect(ownerPasswordResetSchema.safeParse({
      role: 'student',
      schoolId: 'ST-001',
      temporaryPassword: 'secure-temp-pass'
    }).success).toBe(true);
    expect(ownerPasswordResetSchema.safeParse({
      role: 'owner',
      schoolId: 'Umm Raaidah',
      temporaryPassword: 'secure-temp-pass'
    }).success).toBe(false);
    expect(ownerPasswordResetSchema.safeParse({
      role: 'teacher',
      schoolId: 'T-001',
      temporaryPassword: 'short'
    }).success).toBe(false);
  });

  it('validates self-service password resets against school IDs and registered email format', () => {
    expect(selfServicePasswordResetSchema.safeParse({
      role: 'student',
      schoolId: 'ST-001',
      email: 'student@example.com',
      newPassword: 'a-new-secure-password'
    }).success).toBe(true);
    expect(selfServicePasswordResetSchema.safeParse({
      role: 'owner',
      schoolId: 'Umm Raaidah',
      email: 'student@example.com',
      newPassword: 'a-new-secure-password'
    }).success).toBe(false);
    expect(selfServicePasswordResetSchema.safeParse({
      role: 'teacher',
      schoolId: 'T-001',
      email: 'not-an-email',
      newPassword: 'a-new-secure-password'
    }).success).toBe(false);
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

    it('accepts Nursery 1 and Nursery 2 for student records', () => {
      expect(studentSchema.parse({ admissionNumber: 'N-001', name: 'Pearl Student', currentClass: 'Nursery 1' }).currentClass).toBe('Nursery 1');
      expect(studentSchema.parse({ admissionNumber: 'N-002', name: 'Pearl Student', currentClass: 'Nursery 2' }).currentClass).toBe('Nursery 2');
    });
  });
});
