import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '../logger/logger.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      log: typeof logger;
    }
  }
}

/** Assigns a per-request id (propagated into logs and error responses per §30/§31) and a bound child logger. */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && incoming.length <= 100 ? incoming : randomUUID();
  req.log = logger.child({ requestId: req.requestId });
  res.setHeader('x-request-id', req.requestId);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    req.log.info(
      {
        operation: `${req.method} ${req.route?.path ?? req.path}`,
        status: res.statusCode,
        duration: Math.round(durationMs),
        userId: req.user?.id,
      },
      'request completed',
    );
  });

  next();
}
