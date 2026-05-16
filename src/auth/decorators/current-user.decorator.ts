import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserType } from '../../users/enums';

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  userType?: UserType;
  iat?: number;
  exp?: number;
}

export function getCurrentUserFromContext(
  data: keyof JwtPayload | undefined,
  ctx: ExecutionContext,
): JwtPayload | string | number | undefined {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user as JwtPayload | undefined;
  return data ? user?.[data] : user;
}

export const CurrentUser = createParamDecorator<keyof JwtPayload | undefined>(
  getCurrentUserFromContext,
);
