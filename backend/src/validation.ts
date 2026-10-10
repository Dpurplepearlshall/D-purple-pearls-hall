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
  name: z.string().trim().min(2).max(120),
  currentClass: z.enum(['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3', 'Graduated'])
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
  className: z.string().trim().min(1).max(80),
  term: z.enum(['Term 1', 'Term 2', 'Term 3']),
  subject: z.string().trim().min(1).max(80),
  score: z.number().min(0).max(100)
});

export const newsSchema = z.object({
  heading: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1).max(10000)
});

export const schoolCalendarSchema = z.object({
  vacationDate: z.string().date().nullable(),
  resultsReleaseDate: z.string().date().nullable(),
  resumptionDate: z.string().date().nullable()
});
