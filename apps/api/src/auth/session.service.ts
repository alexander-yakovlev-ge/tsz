import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import {
  needsRenewal,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_TTL_SECONDS,
  SessionUser,
  signSessionToken,
  verifySessionToken,
} from '@tsz/shared';
import type { Request, Response } from 'express';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    language: user.language,
  };
}

/** Сессии: JWT в httpOnly-cookie, скользящее продление, проверка token_version (ТЗ п. 5.5). */
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Возвращает пользователя по cookie сессии или null. Недействительную cookie удаляет,
   * действительную продлевает, если до истечения меньше 12 часов.
   */
  async authenticate(req: Request, res: Response): Promise<SessionUser | null> {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || !token) {
      return null;
    }
    const claims = await verifySessionToken(token, env.jwtSecret);
    const user = claims
      ? await this.prisma.user.findFirst({ where: { id: claims.sub, deletedAt: null } })
      : null;
    if (!claims || !user || user.tokenVersion !== claims.tv) {
      this.clear(res);
      return null;
    }
    if (needsRenewal(claims)) {
      await this.issue(res, user);
    }
    return toSessionUser(user);
  }

  async issue(res: Response, user: Pick<User, 'id' | 'role' | 'tokenVersion'>): Promise<void> {
    const token = await signSessionToken(
      { sub: user.id, role: user.role, tv: user.tokenVersion },
      env.jwtSecret,
    );
    res.cookie(SESSION_COOKIE, token, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
  }

  clear(res: Response): void {
    res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS);
  }
}
