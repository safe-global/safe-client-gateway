// SPDX-License-Identifier: FSL-1.1-MIT
import type jwt from 'jsonwebtoken';

export type JwtClient = {
  sign: <
    T extends object & {
      iat?: Date;
      exp?: Date;
      nbf?: Date;
    },
  >(
    payload: T,
    options: { secretOrPrivateKey: string; algorithm?: jwt.Algorithm },
  ) => string;
  verify: <T extends object>(
    token: string,
    options: {
      issuer: string;
      audience?: string;
      secretOrPrivateKey: string;
      algorithms?: Array<jwt.Algorithm>;
    },
  ) => T;
  decode: <T extends object>(
    token: string,
    options: {
      issuer: string;
      audience?: string;
      secretOrPrivateKey: string;
      algorithms?: Array<jwt.Algorithm>;
    },
  ) => jwt.JwtPayload & T;
  decodeWithoutVerification: <T extends object>(
    token: string,
  ) => (jwt.JwtPayload & T) | null;
};
