// SPDX-License-Identifier: FSL-1.1-MIT
import type { Algorithm, JwtPayload } from 'jsonwebtoken';

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
      issuer?: string;
      audience?: string;
      secretOrPrivateKey?: string;
      algorithms?: Array<Algorithm>;
    },
  ): T;

  decode<T extends object>(
    token: string,
    options?: {
      issuer?: string;
      audience?: string;
      secretOrPrivateKey?: string;
      algorithms?: Array<Algorithm>;
    },
  ): JwtPayload & T;

  /**
   * Decodes a JWT payload without verifying signature or expiration.
   * Useful when you need to read claims from potentially expired tokens (logout flow).
   */
  decodeWithoutVerification<T extends object>(token: string): JwtPayload & T;
}
