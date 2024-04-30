import { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';

export const IJwtService = Symbol('IJwtService');

export interface IJwtService {
  sign<T extends object>(
    payload: T,
    options?: {
      issuedAt?: number;
      expiresIn?: number;
      notBefore?: number;
    },
  ): string;

  verify<T extends object>(token: string): T;

  decode<T extends object>(token: string): JwtPayloadWithClaims<T>;
}
