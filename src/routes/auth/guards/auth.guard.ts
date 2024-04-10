import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { IAuthRepository } from '@/domain/auth/auth.repository.interface';
import { AuthService } from '@/routes/auth/auth.service';
import { SiweMessageSchema } from '@/domain/auth/entities/siwe-message.entity';

/**
 * The AuthGuard should be used to protect routes that require authentication.
 *
 * It checks for the presence of a valid JWT access token in the request and
 * verifies its validity before allowing access to the route.
 *
 * 1. Check for the presence of an access token in the request.
 * 2. Verify the token's validity and decode it.
 * 3. Ensure the decoded token is that of a valid SiweMessage.
 * 4. Ensure the token has not expired and is already valid.
 * 5. Allow access if all checks pass.
 */

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(IAuthRepository) private readonly authRepository: IAuthRepository,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const accessToken = this.authRepository.getAccessToken(
      request,
      AuthService.AUTH_TOKEN_TOKEN_TYPE,
    );

    // No token in the request
    if (!accessToken) {
      return false;
    }

    const payload = this.authRepository.verifyAccessToken(accessToken);

    // Token is either not yet valid, expired or malformed
    if (!payload) {
      return false;
    }

    const result = SiweMessageSchema.safeParse(payload);

    // Payload is not a valid SiweMessage
    if (!result.success) {
      return false;
    }

    const { expirationTime, notBefore } = result.data;

    const now = new Date();
    // Should be covered by JWT verification but we check in case
    const isExpired = !!expirationTime && new Date(expirationTime) < now;
    const isValid = notBefore ? new Date(notBefore) < now : true;

    return !isExpired && isValid;
  }
}
