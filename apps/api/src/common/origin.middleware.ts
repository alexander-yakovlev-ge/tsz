import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './api-error';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originHost(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

/**
 * CSRF-защита (ТЗ п. 11): мутирующий запрос принимается, только если заголовок Origin
 * совпадает с доменом сайта. Браузер всегда отправляет Origin на POST/PUT/PATCH/DELETE,
 * поэтому запрос без него тоже отклоняется. Caddy передаёт Host без изменений.
 */
@Injectable()
export class OriginMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method)) {
      return next();
    }
    const origin = req.headers.origin;
    if (!origin || !req.headers.host || originHost(origin) !== req.headers.host) {
      throw new ApiError(HttpStatus.FORBIDDEN, 'ORIGIN_MISMATCH');
    }
    next();
  }
}
