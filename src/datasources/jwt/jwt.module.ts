import jwt from 'jsonwebtoken';
import { Module } from '@nestjs/common';
import { JwtService } from '@/datasources/jwt/jwt.service';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { toSecondsTimestamp } from '@/domain/common/utils/time';
import { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';

// Use inferred type
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function jwtClientFactory() {
  return {
    sign: <
      T extends object & {
        iat?: Date;
        exp?: Date;
        nbf?: Date;
      },
    >(
      payload: T,
      options: { secretOrPrivateKey: string; algorithm?: jwt.Algorithm },
    ): string => {
      // All date-based claims should be second-based NumericDates
      const { exp, iat, nbf, ...rest } = payload;

      return jwt.sign(
        {
          ...(exp && { exp: toSecondsTimestamp(exp) }),
          ...(iat && { iat: toSecondsTimestamp(iat) }),
          ...(nbf && { nbf: toSecondsTimestamp(nbf) }),
          ...rest,
        },
        options.secretOrPrivateKey,
        { algorithm: options.algorithm },
      );
    },
    verify: <T extends object>(
      token: string,
      options: {
        issuer: string;
        secretOrPrivateKey: string;
        algorithms?: Array<jwt.Algorithm>;
      },
    ): T => {
      return jwt.verify(token, options.secretOrPrivateKey, {
        algorithms: options.algorithms,
        issuer: options.issuer,
        // Return only payload without claims, e.g. no exp, nbf, etc.
        complete: false,
      }) as T;
    },
    decode: <T extends object>(
      token: string,
      options: {
        issuer: string;
        secretOrPrivateKey: string;
        algorithms?: Array<jwt.Algorithm>;
      },
    ): JwtPayloadWithClaims<T> => {
      // Client has `decode` method but we also want to verify the signature
      const { payload } = jwt.verify(token, options.secretOrPrivateKey, {
        algorithms: options.algorithms,
        issuer: options.issuer,
        // Return headers, payload (with claims) and signature
        complete: true,
      });

      return payload as JwtPayloadWithClaims<T>;
    },
  };
}

export type JwtClient = ReturnType<typeof jwtClientFactory>;

@Module({
  providers: [
    {
      provide: 'JwtClient',
      useFactory: jwtClientFactory,
    },
    { provide: IJwtService, useClass: JwtService },
  ],
  exports: [IJwtService],
})
export class JwtModule {}
