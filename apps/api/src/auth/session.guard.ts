import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@tsz/shared';
import type { Request, Response } from 'express';
import { ApiError } from '../common/api-error';
import { PUBLIC_KEY, ROLES_KEY } from './decorators';
import { SessionService } from './session.service';

/**
 * Глобальный guard (ТЗ п. 11): проверяет сессию на каждом запросе и роль на эндпоинтах с @Roles().
 * Эндпоинты без @Public() требуют входа.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const user = await this.sessions.authenticate(req, http.getResponse<Response>());
    if (user) {
      req.user = user;
    }

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) {
      return true;
    }
    if (!user) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED');
    }
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(user.role)) {
      throw new ApiError(HttpStatus.FORBIDDEN, 'FORBIDDEN');
    }
    return true;
  }
}
