import { AuthController } from '@/modules/auth/routes/auth.controller';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { type Request } from 'express';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly authGuard: AuthGuard) {}
  canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest();

    const accessToken: string | undefined =
      request.cookies[AuthController.ACCESS_TOKEN_COOKIE_NAME];

    /**
     * If there is no access token, we allow the request to proceed as
     * we may have public/private access on the same route.
     */
    if (!accessToken) {
      return true;
    }

    return this.authGuard.canActivate(context);
  }
}
