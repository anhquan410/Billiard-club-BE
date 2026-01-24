/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lấy roles từ decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      // Route không yêu cầu role => ai cũng vào được
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    // User đã được decode từ JWT
    if (!user || !user.role) {
      throw new ForbiddenException('No user or role');
    }

    // Nếu user.role nằm trong danh sách requiredRoles thì cho vào
    if (requiredRoles.includes(user.role)) {
      return true;
    }
    throw new ForbiddenException('Insufficient role');
  }
}
