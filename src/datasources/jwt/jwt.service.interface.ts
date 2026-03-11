import type { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import type { Algorithm } from 'jsonwebtoken';

export const IJwtService = Symbol('IJwtService');

export interface IJwtService {
  sign<
    T extends object & {
      iat?: Date;
      exp?: Date;
      nbf?: Date;
    },
  >(
    payload: T,
    options?: {
      secretOrPrivateKey: string;
      algorithm?: Algorithm;
    },
  ): string;

  verify<T extends object>(
    token: string,
    options?: {
      issuer: string;
      audience?: string;
      secretOrPrivateKey: string;
      algorithms?: Array<Algorithm>;
    },
  ): T;

  decode<T extends object>(
    token: string,
    options?: {
      issuer: string;
      audience?: string;
      secretOrPrivateKey: string;
      algorithms?: Array<Algorithm>;
    },
  ): JwtPayloadWithClaims<T>;
}
