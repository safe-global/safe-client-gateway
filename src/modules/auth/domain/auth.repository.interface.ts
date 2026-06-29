// SPDX-License-Identifier: FSL-1.1-MIT

import type { JwtPayloadWithClaims as AuthPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import type { AuthPayloadDto } from '@/modules/auth/domain/entities/auth-payload.entity';

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

  decodeTokenWithoutVerification(
    accessToken: string,
  ): AuthPayloadWithClaims<AuthPayloadDto> | null;

  /**
   * Mints a short-lived, self-contained token that proves the user passed TOTP
   * recently. It is distinct from the session token (a different `type` claim)
   * and validating it requires no database lookup.
   */
  signTotpElevationToken(args: { userId: string; exp: Date }): string;

  /**
   * Verifies a TOTP elevation token and returns the user it was issued for.
   * Throws if the signature, type, or expiry is invalid.
   */
  verifyTotpElevationToken(token: string): { userId: string };
}
