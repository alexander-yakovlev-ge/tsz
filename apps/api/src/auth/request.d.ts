import type { SessionUser } from '@tsz/shared';

declare global {
  namespace Express {
    interface Request {
      /** Заполняется SessionGuard, если сессия действительна */
      user?: SessionUser;
    }
  }
}
