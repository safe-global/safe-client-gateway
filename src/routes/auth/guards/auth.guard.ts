import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { IAuthRepository } from '@/routes/auth/auth.repository.interface';
import { AuthController } from '@/routes/auth/auth.controller';

/**
 * The AuthGuard should be used to protect routes that require authentication.
 *
 * It checks for the presence of a valid JWT access token in the request and
 * verifies its validity before allowing access to the route.
 *
 * 1. Check for the presence of an access token in the request.
 * 2. Verify the token's validity.
 * 3. If valid, allow access.
 */

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(IAuthRepository) private readonly authRepository: IAuthRepository,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const accessToken =
      request.cookies[AuthController.ACCESS_TOKEN_COOKIE_NAME];

    // No token in the request
    if (!accessToken) {
      return false;
    }

    try {
      this.authRepository.verifyToken(accessToken);
      return true;
    } catch {
      return false;
    }
  }
}
