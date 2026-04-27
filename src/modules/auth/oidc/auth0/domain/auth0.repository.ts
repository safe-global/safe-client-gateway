// SPDX-License-Identifier: FSL-1.1-MIT
import { IAuth0Api } from '@/modules/auth/oidc/auth0/datasources/auth0-api.interface';
import { IAuth0Repository } from '@/modules/auth/oidc/auth0/domain/auth0.repository.interface';
import {
  LoggingService,
  type ILoggingService,
} from '@/logging/logging.interface';
import { Inject, Injectable } from '@nestjs/common';
import { Auth0TokenVerifier } from '@/modules/auth/oidc/auth0/domain/auth0-token.verifier';
import { Auth0Token } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';
import { Auth0TokenResponseSchema } from '@/modules/auth/oidc/auth0/datasources/entities/auth0-token-response.entity';

@Injectable()
export class Auth0Repository implements IAuth0Repository {
  constructor(
    @Inject(IAuth0Api)
    private readonly auth0Api: IAuth0Api,
    private readonly auth0TokenVerifier: Auth0TokenVerifier,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public getAuthorizationUrl(state: string, connection?: string): string {
    return this.auth0Api.getAuthorizationUrl(state, connection);
  }

  public async authenticateWithAuthorizationCode(
    code: string,
  ): Promise<Auth0Token> {
    this.loggingService.debug(
      'Auth0: exchanging authorization code for tokens',
    );
    const response = await this.auth0Api.exchangeAuthorizationCode(code);
    const { id_token } = Auth0TokenResponseSchema.parse(response);
    this.loggingService.debug('Auth0: received id_token from token exchange');
    return this.auth0TokenVerifier.verifyAndDecode(id_token);
  }
}
