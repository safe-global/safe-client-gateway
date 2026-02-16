import { Inject, Injectable } from '@nestjs/common';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import {
  type AuthPayloadDto,
  AuthPayloadDtoSchema,
} from '@/modules/auth/domain/entities/auth-payload.entity';
import {
  JwtClaimsSchema,
  type JwtPayloadWithClaims,
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
      exp?: Date;
      nbf?: Date;
      iat?: Date;
    },
  ): string {
    const authPayloadDto = AuthPayloadDtoSchema.parse(payload);
    return this.jwtService.sign({
      ...authPayloadDto,
      exp: options?.exp,
      nbf: options?.nbf,
      iat: options?.iat,
    });
  }

  verifyToken(accessToken: string): AuthPayloadDto {
    const payload = this.jwtService.verify(accessToken);
    return AuthPayloadDtoSchema.parse(payload);
  }

  decodeToken(accessToken: string): JwtPayloadWithClaims<AuthPayloadDto> {
    const decoded = this.jwtService.decode(accessToken);
    return AuthPayloadDtoSchema.extend(JwtClaimsSchema.shape).parse(decoded);
  }
}
