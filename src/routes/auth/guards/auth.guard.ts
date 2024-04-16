import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { IJwtRepository } from '@/domain/jwt/jwt.repository.interface';
import { AuthController } from '@/routes/auth/auth.controller';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';

/**
 * The AuthGuard should be used to protect routes that require authentication.
 *
 * It checks for the presence of a valid JWT access token in the request and
 * verifies its validity before allowing access to the route.
 *
 * 1. Check for the presence of an access token/Safe address in the request.
 * 2. Verify the token's validity.
 * 3. If valid, check if the signer is an owner of the Safe.
 * 4. If the signer is an owner, allow access.
 */

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(IJwtRepository) private readonly jwtRepository: IJwtRepository,
    @Inject(ISafeRepository) private readonly safeRepository: ISafeRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const { safeAddress } = request.params;
    const accessToken =
      request.cookies[AuthController.ACCESS_TOKEN_COOKIE_NAME];

    if (!safeAddress || !accessToken) {
      return false;
    }

    try {
      const { chain_id, signer_address } =
        this.jwtRepository.verifyToken(accessToken);

      return await this.safeRepository.isOwner({
        chainId: chain_id,
        address: signer_address,
        safeAddress,
      });
    } catch {
      return false;
    }
  }
}
