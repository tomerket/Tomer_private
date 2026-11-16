import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wraps an async route so thrown errors reach the error handler. */
export const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

/** Parses "MM-DD-YYYY" into ISO "YYYY-MM-DD", or throws 400. */
export function parseBirthday(input: unknown): string {
  const m = typeof input === 'string' ? /^(\d{2})-(\d{2})-(\d{4})$/.exec(input.trim()) : null;
  if (!m) throw new HttpError(400, 'Birthday must be in MM-DD-YYYY format');
  const [, mm, dd, yyyy] = m;
  const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd));
  const valid =
    d.getUTCFullYear() === +yyyy && d.getUTCMonth() === +mm - 1 && d.getUTCDate() === +dd;
  if (!valid || +yyyy < 1900 || d.getTime() > Date.now()) {
    throw new HttpError(400, 'Birthday is not a valid date');
  }
  return `${yyyy}-${mm}-${dd}`;
}

/** Validates a "YYYY-MM-DD" day string (the browser's local date). */
export function parseDay(input: unknown): string {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new HttpError(400, 'day must be YYYY-MM-DD');
  }
  return input;
}

export function requireText(input: unknown, field: string, max: number): string {
  const s = typeof input === 'string' ? input.trim() : '';
  if (!s) throw new HttpError(400, `${field} is required`);
  if (s.length > max) throw new HttpError(400, `${field} is too long (max ${max})`);
  return s;
}
