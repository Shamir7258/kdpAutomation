import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { AppError } from '../errors/app-error.js';

type Source = 'body' | 'query' | 'params';

/** Parses `req[source]` against `schema`, replacing it with the parsed (and coerced/defaulted) value, or throws a 400 AppError. */
export function validate<S extends ZodTypeAny>(schema: S, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(AppError.validation('Request validation failed', result.error.flatten()));
      return;
    }
    req[source] = result.data as z.infer<S>;
    next();
  };
}
