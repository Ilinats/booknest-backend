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
import { AuthErrors } from '../errors/auth-errors';

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
      throw new ForbiddenException(AuthErrors.ROLE_ACCESS_REQUIRED);
    }

    const userRole = user.userType;

    if (!userRole || !requiredRoles.includes(userRole)) {
      const errorCode = this.getRequiredRoleError(requiredRoles);
      throw new ForbiddenException(errorCode);
    }

    return true;
  }

  private getRequiredRoleError(requiredRoles: UserType[]): AuthErrors {
    if (requiredRoles.includes(UserType.AUTHOR)) {
      return AuthErrors.AUTHOR_ACCESS_REQUIRED;
    }
    if (requiredRoles.includes(UserType.READER)) {
      return AuthErrors.READER_ACCESS_REQUIRED;
    }
    return AuthErrors.ROLE_ACCESS_REQUIRED;
  }
}
