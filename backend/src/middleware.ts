import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export const notFound = (_req: unknown, res: { status: (n: number) => { json: (x: unknown) => void } }) => {
  res.status(404).json({ error: 'Route not found.' });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Invalid input.', details: error.issues.map((issue) => issue.message) });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Unexpected server error.' });
};
