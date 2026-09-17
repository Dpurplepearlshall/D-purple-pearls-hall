import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(128)
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128)
});

export const studentSchema = z.object({
  admissionNumber: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9/-]+$/),
  name: z.string().trim().min(2).max(120)
});

export const teacherSchema = z.object({
  teacherId: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9/-]+$/),
  name: z.string().trim().min(2).max(120)
});

export const registrationSchema = z.object({
  admissionNumber: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(128)
});

export const teacherRegistrationSchema = z.object({
  teacherId: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(128)
});

export const resultSchema = z.object({
  studentAdmissionNumber: z.string().trim().min(1).max(40),
  term: z.enum(['Term 1', 'Term 2', 'Term 3']),
  subject: z.string().trim().min(1).max(80),
  score: z.number().min(0).max(100)
});
