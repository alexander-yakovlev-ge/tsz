import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { LoginInput, loginSchema, normalizePhone, SessionUser } from '@tsz/shared';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/api-error';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, Public } from './decorators';
import { LoginLimiterService } from './login-limiter.service';
import { verifyPassword } from './passwords';
import { SessionService, toSessionUser } from './session.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly limiter: LoginLimiterService,
    private readonly audit: AuditService,
  ) {}

  /** Вход по телефону и паролю (ТЗ п. 5.1). */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser }> {
    const ip = req.ip ?? 'unknown';
    const limit = this.limiter.hit(ip);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, 'TOO_MANY_ATTEMPTS');
    }

    const phone = normalizePhone(body.phone);
    const user = phone
      ? await this.prisma.user.findFirst({ where: { phone, deletedAt: null } })
      : null;
    if (!(await verifyPassword(body.password, user?.passwordHash ?? null)) || !user) {
      await this.audit.log({
        userId: null,
        action: 'auth.login_failed',
        payload: { phone: phone ?? body.phone },
        ip,
      });
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS');
    }

    await this.sessions.issue(res, user);
    await this.audit.log({
      userId: user.id,
      action: 'auth.login',
      entity: 'user',
      entityId: user.id,
      ip,
    });
    return { user: toSessionUser(user) };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: SessionUser | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    this.sessions.clear(res);
    if (user) {
      await this.audit.log({
        userId: user.id,
        action: 'auth.logout',
        entity: 'user',
        entityId: user.id,
        ip: req.ip,
      });
    }
  }

  /** Текущий пользователь; null — не вошёл или сессия завершена. */
  @Public()
  @Get('session')
  session(@CurrentUser() user: SessionUser | undefined): { user: SessionUser | null } {
    return { user: user ?? null };
  }
}
