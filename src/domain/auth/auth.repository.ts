import { Inject, Injectable } from '@nestjs/common';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { IAuthRepository } from '@/domain/auth/auth.repository.interface';
import {
  AuthPayload,
  AuthPayloadSchema,
} from '@/domain/auth/entities/auth-payload.entity';
import {
  JwtClaimsSchema,
  JwtPayloadWithClaims,
} from '@/datasources/jwt/jwt-claims.entity';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';

@Injectable()
export class AuthRepository implements IAuthRepository {
  constructor(
    @Inject(IJwtService)
    private readonly jwtService: IJwtService,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
  ) {}

  signToken<T extends AuthPayload>(
    payload: T,
    options?: {
      expiresIn?: number;
      notBefore?: number;
    },
  ): string {
    return this.jwtService.sign(payload, options);
  }

  verifyToken(accessToken: string): AuthPayload {
    const payload = this.jwtService.verify(accessToken);
    return AuthPayloadSchema.parse(payload);
  }

  decodeToken(accessToken: string): JwtPayloadWithClaims<AuthPayload> {
    const decoded = this.jwtService.decode(accessToken);
    return AuthPayloadSchema.merge(JwtClaimsSchema).parse(decoded);
  }

  isChain(args: { chainId: string; authPayload?: AuthPayload }): boolean {
    return args.authPayload?.chain_id === args.chainId;
  }

  isSigner(args: {
    signerAddress: `0x${string}`;
    authPayload?: AuthPayload;
  }): boolean {
    // Lowercase ensures a mixture of (non-)checksummed addresses are compared correctly
    return (
      args.authPayload?.signer_address.toLowerCase() ===
      args.signerAddress.toLowerCase()
    );
  }

  async isSafeOwner(args: {
    safeAddress: `0x${string}`;
    authPayload?: AuthPayload;
  }): Promise<boolean> {
    if (!args.authPayload) {
      return false;
    }
    return await this.safeRepository
      .isOwner({
        safeAddress: args.safeAddress,
        chainId: args.authPayload.chain_id,
        address: args.authPayload.signer_address,
      })
      // Swallow error so as to not leak information
      .catch(() => false);
  }
}
