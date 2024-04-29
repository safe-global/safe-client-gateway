import { Inject, Injectable } from '@nestjs/common';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { IAuthRepository } from '@/domain/auth/auth.repository.interface';
import {
  AuthPayloadDto,
  AuthPayloadDtoSchema,
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

  signToken<T extends AuthPayloadDto>(
    payload: T,
    options?: {
      expiresIn?: number;
      notBefore?: number;
    },
  ): string {
    // TODO: Verify payload before signing it
    return this.jwtService.sign(payload, options);
  }

  verifyToken(accessToken: string): AuthPayloadDto {
    const payload = this.jwtService.verify(accessToken);
    return AuthPayloadDtoSchema.parse(payload);
  }

  decodeToken(accessToken: string): JwtPayloadWithClaims<AuthPayloadDto> {
    const decoded = this.jwtService.decode(accessToken);
    return AuthPayloadDtoSchema.merge(JwtClaimsSchema).parse(decoded);
  }
}
