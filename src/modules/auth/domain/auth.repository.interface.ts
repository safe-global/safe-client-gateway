import type { AuthPayloadDto } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { JwtPayloadWithClaims as AuthPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';

export const IAuthRepository = Symbol('IAuthRepository');

export interface IAuthRepository {
  signToken<T extends AuthPayloadDto>(
    payload: T,
    options?: {
      exp?: Date;
      nbf?: Date;
      iat?: Date;
    },
  ): string;

  verifyToken(accessToken: string): AuthPayloadDto;

  decodeToken(accessToken: string): AuthPayloadWithClaims<AuthPayloadDto>;
}
