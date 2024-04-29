import { Inject, Injectable } from '@nestjs/common';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { IAuthRepository } from '@/domain/auth/auth.repository.interface';
import {
  AuthPayloadDto,
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

  signToken<T extends AuthPayloadDto>(
    payload: T,
    options?: {
      expiresIn?: number;
      notBefore?: number;
    },
  ): string {
    // TODO: Validate here before signing
    return this.jwtService.sign(payload, options);
  }

  verifyToken(accessToken: string): AuthPayloadDto {
    const payload = this.jwtService.verify(accessToken);
    return AuthPayloadSchema.parse(payload);
  }

  decodeToken(accessToken: string): JwtPayloadWithClaims<AuthPayloadDto> {
    const decoded = this.jwtService.decode(accessToken);
    return AuthPayloadSchema.merge(JwtClaimsSchema).parse(decoded);
  }
}
