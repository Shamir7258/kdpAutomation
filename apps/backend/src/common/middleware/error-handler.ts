import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES, type ApiFailure } from '@kdp/shared';
import { AppError } from '../errors/app-error.js';

export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiFailure = {
    success: false,
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `No route matches ${req.method} ${req.path}`,
      requestId: req.requestId,
    },
  };
  res.status(404).json(body);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      req.log?.error({ err, code: err.code }, err.message);
    } else {
      req.log?.warn({ code: err.code }, err.message);
    }
    const body: ApiFailure = {
      success: false,
      error: { code: err.code, message: err.message, requestId: req.requestId, details: err.details },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  req.log?.error({ err }, 'unhandled error');
  const body: ApiFailure = {
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'Something went wrong. Please try again.',
      requestId: req.requestId,
    },
  };
  res.status(500).json(body);
}
