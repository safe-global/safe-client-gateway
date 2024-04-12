import { Inject, Injectable } from '@nestjs/common';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { IJwtRepository } from '@/domain/jwt/jwt.repository.interface';
import {
  JwtAccessTokenPayload,
  JwtAccessTokenPayloadSchema,
} from '@/routes/auth/entities/jwt-access-token.payload.entity';

@Injectable()
export class JwtRepository implements IJwtRepository {
  constructor(
    @Inject(IJwtService)
    private readonly jwtService: IJwtService,
  ) {}

  signToken<T extends string | object>(
    payload: T,
    options?: {
      expiresIn?: number;
      notBefore?: number;
    },
  ): string {
    return this.jwtService.sign(payload, options);
  }

  verifyToken(accessToken: string): JwtAccessTokenPayload {
    const payload = this.jwtService.verify(accessToken);
    return JwtAccessTokenPayloadSchema.parse(payload);
  }
}
