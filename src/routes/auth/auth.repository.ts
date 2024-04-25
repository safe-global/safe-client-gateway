import { Inject, Injectable } from '@nestjs/common';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { IAuthRepository } from '@/routes/auth/auth.repository.interface';
import {
  AuthPayload,
  AuthPayloadSchema,
} from '@/routes/auth/entities/auth-payload.entity';
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
}
