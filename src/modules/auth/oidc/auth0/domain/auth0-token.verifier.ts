// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import { JWT_RS_ALGORITHM } from '@/datasources/jwt/jwt.constants';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { AUTH0_JWKS_PATH } from '@/modules/auth/oidc/auth0/auth0.constants';
import type { Auth0Token } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';
import { Auth0TokenSchema } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  createRemoteJWKSet,
  errors,
  type JWTVerifyGetKey,
  jwtVerify,
} from 'jose';
import { z } from 'zod';

@Injectable()
export class Auth0TokenVerifier {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: JWTVerifyGetKey;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    const domain =
      this.configurationService.getOrThrow<string>('auth.auth0.domain');
    this.issuer = `https://${domain}/`;
    this.audience = this.configurationService.getOrThrow<string>(
      'auth.auth0.clientId',
    );
    this.jwks = createRemoteJWKSet(new URL(AUTH0_JWKS_PATH, this.issuer), {
      cacheMaxAge: this.configurationService.getOrThrow<number>(
        'auth.auth0.jwksCacheMaxAgeMs',
      ),
      cooldownDuration: this.configurationService.getOrThrow<number>(
        'auth.auth0.jwksCooldownMs',
      ),
    });
  }

  /**
   * Verifies an Auth0 JWT against the tenant JWKS and returns validated token claims.
   *
   * The audience is the Auth0 application client ID, not the API audience used
   * for access tokens.
   */
  public async verifyAndDecode(jwt: string): Promise<Auth0Token> {
    try {
      const { payload } = await jwtVerify(jwt, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: [JWT_RS_ALGORITHM],
      });
      const token = Auth0TokenSchema.parse(payload);
      return token;
    } catch (error) {
      if (error instanceof errors.JOSEError || error instanceof z.ZodError) {
        this.loggingService.debug(
          `Auth0: JWT verification failed: ${error.message}`,
        );
        throw new UnauthorizedException('Invalid JWT');
      }

      throw error;
    }
  }
}
