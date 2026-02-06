import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const User = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user;

    // Nếu có truyền field cụ thể (VD: 'id', 'email'), trả về field đó
    if (data && user && typeof user === 'object') {
      return user[data as keyof typeof user];
    }

    // Nếu không, trả về toàn bộ user object
    return user;
  },
);
