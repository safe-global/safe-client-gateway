// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  createRemoteJWKSet,
  errors,
  type JWTVerifyGetKey,
  jwtVerify,
} from 'jose';
import { z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { JWT_RS_ALGORITHM } from '@/datasources/jwt/jwt.constants';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { AUTH0_JWKS_PATH } from '@/modules/auth/oidc/auth0/auth0.constants';
import {
  type Auth0AccessToken,
  Auth0AccessTokenSchema,
} from '@/modules/auth/oidc/auth0/domain/entities/auth0-access-token.entity';
import type { Auth0Token } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';
import { Auth0TokenSchema } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';

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
   * @param idToken - The raw ID token string to verify.
   * @returns The decoded and validated {@link Auth0Token} claims.
   * @throws {UnauthorizedException} If the ID token is invalid, expired, or fails verification.
   */
  public async verifyAndDecode(idToken: string): Promise<Auth0Token> {
    return await this.verify({
      token: idToken,
      audience: this.audience,
      schema: Auth0TokenSchema,
      tokenType: 'ID token',
    });
  }

  /**
   * Verifies an Auth0 access token issued for the API identified by
   * {@link audience} and returns its validated claims.
   *
   * @throws {UnauthorizedException} If the access token is invalid, expired,
   *   issued for another audience, or fails verification.
   */
  public async verifyAccessToken(
    accessToken: string,
    audience: string,
  ): Promise<Auth0AccessToken> {
    return await this.verify({
      token: accessToken,
      audience,
      schema: Auth0AccessTokenSchema,
      tokenType: 'access token',
    });
  }

  private async verify<T extends z.ZodType>(args: {
    token: string;
    audience: string;
    schema: T;
    tokenType: string;
  }): Promise<z.infer<T>> {
    try {
      const { payload } = await jwtVerify(args.token, this.jwks, {
        issuer: this.issuer,
        audience: args.audience,
        algorithms: [JWT_RS_ALGORITHM],
      });
      return args.schema.parse(payload);
    } catch (error) {
      if (error instanceof errors.JOSEError || error instanceof z.ZodError) {
        this.loggingService.debug(
          `Auth0: ${args.tokenType} verification failed: ${error.message}`,
        );
        throw new UnauthorizedException(`Invalid ${args.tokenType}`);
      }

      throw error;
    }
  }
}
