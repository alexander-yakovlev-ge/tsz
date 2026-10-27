import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role, SessionUser } from '@tsz/shared';
import type { Request } from 'express';

export const PUBLIC_KEY = 'auth:public';
export const ROLES_KEY = 'auth:roles';

/** Эндпоинт доступен без входа. По умолчанию все эндпоинты требуют сессию. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Эндпоинт доступен только перечисленным ролям. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Текущий пользователь; на эндпоинтах без @Public() всегда есть. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser | undefined =>
    ctx.switchToHttp().getRequest<Request>().user,
);
