import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  roles: string[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): AuthenticatedUser | unknown => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
