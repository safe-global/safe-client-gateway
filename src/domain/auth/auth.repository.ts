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

@Injectable()
export class AuthRepository implements IAuthRepository {
  constructor(
    @Inject(IJwtService)
    private readonly jwtService: IJwtService,
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
}
