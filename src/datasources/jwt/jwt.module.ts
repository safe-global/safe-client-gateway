import jwt from 'jsonwebtoken';
import { Module } from '@nestjs/common';
import { JwtService } from '@/datasources/jwt/jwt.service';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import { JWT_CONFIGURATION_MODULE } from '@/datasources/jwt/configuration/jwt.configuration.module';

// Use inferred type
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function jwtClientFactory(configurationService: IConfigurationService) {
  const issuer = configurationService.getOrThrow<string>('jwt.issuer');
  const secret = configurationService.getOrThrow<string>('jwt.secret');

  return {
    sign: <T extends object>(
      payload: T,
      options: {
        issuedAt?: number;
        expiresIn?: number;
        notBefore?: number;
      } = {},
    ): string => {
      const { issuedAt = Date.now() / 1_000, ...claims } = options;

      return jwt.sign(
        {
          // iat (Issued At) claim is set in payload
          // @see https://github.com/auth0/node-jsonwebtoken/blob/bc28861f1fa981ed9c009e29c044a19760a0b128/sign.js#L185
          iat: issuedAt,
          ...payload,
        },
        secret,
        {
          ...claims,
          issuer,
        },
      );
    },
    verify: <T extends object>(token: string): T => {
      return jwt.verify(token, secret, {
        issuer,
        // Return only payload without claims, e.g. no exp, nbf, etc.
        complete: false,
      }) as T;
    },
    decode: <T extends object>(token: string): JwtPayloadWithClaims<T> => {
      // Client has `decode` method but we also want to verify the signature
      const { payload } = jwt.verify(token, secret, {
        issuer,
        // Return headers, payload (with claims) and signature
        complete: true,
      });

      return payload as JwtPayloadWithClaims<T>;
    },
  };
}

export type JwtClient = ReturnType<typeof jwtClientFactory>;

@Module({
  imports: [JWT_CONFIGURATION_MODULE],
  providers: [
    {
      provide: 'JwtClient',
      useFactory: jwtClientFactory,
      inject: [IConfigurationService],
    },
    { provide: IJwtService, useClass: JwtService },
  ],
  exports: [IJwtService],
})
export class JwtModule {}
