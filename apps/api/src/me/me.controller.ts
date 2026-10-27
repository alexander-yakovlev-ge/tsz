import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ChangePasswordInput, changePasswordSchema, SessionUser } from '@tsz/shared';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/decorators';
import { hashPassword, verifyPassword } from '../auth/passwords';
import { SessionService } from '../auth/session.service';
import { ApiError } from '../common/api-error';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';

/** Личный кабинет (ТЗ п. 9). Остальные эндпоинты /api/me появятся на этапах 4–6. */
@Controller('me')
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Смена пароля (ТЗ п. 5.3). token_version увеличивается — сессии на других устройствах
   * завершаются, а текущему устройству выдаётся новая cookie.
   */
  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodPipe(changePasswordSchema)) body: ChangePasswordInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (!(await verifyPassword(body.currentPassword, current.passwordHash))) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'WRONG_PASSWORD');
    }
    const user = await this.prisma.user.update({
      where: { id: actor.id },
      data: { passwordHash: await hashPassword(body.newPassword), tokenVersion: { increment: 1 } },
    });
    await this.sessions.issue(res, user);
    await this.audit.log({
      userId: actor.id,
      action: 'auth.password_change',
      entity: 'user',
      entityId: actor.id,
      ip: req.ip,
    });
  }
}
