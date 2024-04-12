import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { IJwtRepository } from '@/domain/jwt/jwt.repository.interface';
import { AuthService } from '@/routes/auth/auth.service';
import { Request } from 'express';

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
    @Inject(IJwtRepository) private readonly jwtRepository: IJwtRepository,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const accessToken = this.getAccessToken(
      request,
      AuthService.AUTH_TOKEN_TOKEN_TYPE,
    );

    // No token in the request
    if (!accessToken) {
      return false;
    }

    try {
      this.jwtRepository.verifyToken(accessToken);
      return true;
    } catch {
      return false;
    }
  }

  private getAccessToken(request: Request, tokenType: string): string | null {
    const header = request.headers.authorization;

    if (!header) {
      return null;
    }

    const [type, token] = header.split(' ');

    if (type !== tokenType || !token) {
      return null;
    }

    return token;
  }
}
