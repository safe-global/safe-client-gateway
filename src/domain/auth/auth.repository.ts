import { Inject, Injectable } from '@nestjs/common';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { IAuthRepository } from '@/domain/auth/auth.repository.interface';
import {
  AuthPayloadDto,
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

  verifyToken(accessToken: string): AuthPayload {
    const payload = this.jwtService.verify(accessToken);
    const data = AuthPayloadSchema.parse(payload);
    return new AuthPayload(data);
  }

  decodeToken(accessToken: string): JwtPayloadWithClaims<AuthPayload> {
    const decoded = this.jwtService.decode(accessToken);
    const data = AuthPayloadSchema.merge(JwtClaimsSchema).parse(decoded);
    // TODO: Clean this up to not use Object.assign, perhaps not reducing the
    //        payload as this method is only used for retrieving the exp claim
    return Object.assign(new AuthPayload(data), data);
  }
}
