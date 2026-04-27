// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import { JWT_RS_ALGORITHM } from '@/datasources/jwt/jwt.constants';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  IAuth0IdTokenJwks,
  type IAuth0IdTokenJwks as Auth0IdTokenJwks,
} from '@/modules/auth/oidc/auth0/domain/auth0-id-token-jwks.interface';
import type { Auth0Token } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';
import { Auth0TokenSchema } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { errors, jwtVerify } from 'jose';
import { z } from 'zod';

@Injectable()
export class Auth0TokenVerifier {
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IAuth0IdTokenJwks)
    private readonly jwks: Auth0IdTokenJwks,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    const domain =
      this.configurationService.getOrThrow<string>('auth.auth0.domain');
    this.issuer = `https://${domain}/`;
    this.audience = this.configurationService.getOrThrow<string>(
      'auth.auth0.clientId',
    );
  }

  /**
   * Verifies an Auth0 ID token against the tenant JWKS and returns validated token claims.
   *
   * The ID token audience is the Auth0 application client ID, not the API audience used
   * for Auth0 access tokens.
   */
  public async verifyAndDecode(idToken: string): Promise<Auth0Token> {
    try {
      const { payload } = await jwtVerify(idToken, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: [JWT_RS_ALGORITHM],
      });
      const token = Auth0TokenSchema.parse(payload);
      this.loggingService.debug(
        `Auth0: id token verified successfully for sub ${token.sub}`,
      );
      return token;
    } catch (error) {
      if (error instanceof errors.JOSEError || error instanceof z.ZodError) {
        this.loggingService.debug(
          `Auth0: id token verification failed: ${error.message}`,
        );
        throw new UnauthorizedException('Invalid id token');
      }

      throw error;
    }
  }
}
