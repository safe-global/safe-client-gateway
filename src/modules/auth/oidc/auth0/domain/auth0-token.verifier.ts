// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import { JWT_ALGORITHM } from '@/datasources/jwt/jwt.constants';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { Auth0Token } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';
import { Auth0TokenSchema } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JsonWebTokenError } from 'jsonwebtoken';

@Injectable()
export class Auth0TokenVerifier {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly signingSecret: string;

  constructor(
    @Inject(IJwtService)
    private readonly jwtService: IJwtService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    const domain =
      this.configurationService.getOrThrow<string>('auth.auth0.domain');
    this.issuer = `https://${domain}/`;
    this.audience = this.configurationService.getOrThrow<string>(
      'auth.auth0.audience',
    );
    this.signingSecret = this.configurationService.getOrThrow<string>(
      'auth.auth0.signingSecret',
    );
  }

  verifyAndDecode(accessToken: string): Auth0Token {
    try {
      const decoded = this.jwtService.decode<{ sub: string }>(accessToken, {
        issuer: this.issuer,
        audience: this.audience,
        secretOrPrivateKey: this.signingSecret,
        algorithms: [JWT_ALGORITHM],
      });
      return Auth0TokenSchema.parse(decoded);
    } catch (error) {
      if (error instanceof JsonWebTokenError) {
        this.loggingService.debug(
          `Auth0: JWT verification failed: ${error.message}`,
        );
        throw new UnauthorizedException('Invalid access token');
      }
      throw error;
    }
  }
}
