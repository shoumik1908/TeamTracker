import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  // A rejected upload is the caller's mistake, not a server fault. Without this it
  // fell through to the 500 below, which both mislabelled it and — in production —
  // replaced the explanation with "Internal server error", so the allow-list and
  // size-limit messages never reached the person who needed them.
  if (err instanceof MulterError) {
    const readable: Record<string, string> = {
      LIMIT_FILE_SIZE: 'That file is too large.',
      LIMIT_FILE_COUNT: 'Too many files in one upload.',
      LIMIT_UNEXPECTED_FILE: `Unexpected upload field "${err.field ?? ''}".`,
    };
    return res.status(400).json({ error: readable[err.code] ?? err.message });
  }

  // Prisma errors
  if (err.message.includes('Unique constraint')) {
    return res.status(409).json({ error: 'Record already exists' });
  }
  if (err.message.includes('Record to update not found')) {
    return res.status(404).json({ error: 'Record not found' });
  }

  return res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};
