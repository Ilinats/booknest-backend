import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserType } from '../../users/enums';
import { JwtPayload } from '../decorators/current-user.decorator';
import { AuthErrorCode, AuthErrors } from '../../common/errors/auth-errors';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserType[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (!user) {
      const error = AuthErrors[AuthErrorCode.ROLE_ACCESS_REQUIRED_ERROR];
      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    const userRole = user.userType;

    if (!userRole || !requiredRoles.includes(userRole as UserType)) {
      let error;
      if (
        requiredRoles.includes(UserType.AUTHOR) ||
        requiredRoles.includes('author' as any)
      ) {
        error = AuthErrors[AuthErrorCode.AUTHOR_ACCESS_REQUIRED_ERROR];
      } else if (
        requiredRoles.includes(UserType.READER) ||
        requiredRoles.includes('reader' as any)
      ) {
        error = AuthErrors[AuthErrorCode.READER_ACCESS_REQUIRED_ERROR];
      } else {
        error = AuthErrors[AuthErrorCode.ROLE_ACCESS_REQUIRED_ERROR];
      }

      throw new ForbiddenException({
        message: error.message,
        code: error.code,
      });
    }

    return true;
  }
}
