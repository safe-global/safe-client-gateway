// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IAuth0Api } from '@/modules/auth/auth0/datasources/auth0-api.interface';
import { IAuth0Repository } from '@/modules/auth/auth0/domain/auth0.repository.interface';
import { Inject, Injectable } from '@nestjs/common';
import { Auth0TokenVerifier } from '@/modules/auth/auth0/domain/auth0-token.verifier';
import { Auth0Token } from '@/modules/auth/auth0/domain/entities/auth0-token.entity';
import { Auth0TokenResponseSchema } from '@/modules/auth/auth0/datasources/entities/auth0-token-response.entity';

@Injectable()
export class Auth0Repository implements IAuth0Repository {
  private readonly baseUri: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly audience: string;
  private readonly scope: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IAuth0Api)
    private readonly auth0Api: IAuth0Api,
    private readonly auth0TokenVerifier: Auth0TokenVerifier,
  ) {
    const prefix = 'auth.auth0';
    this.baseUri = this.configurationService.getOrThrow<string>(
      `${prefix}.baseUri`,
    );
    this.clientId = this.configurationService.getOrThrow<string>(
      `${prefix}.clientId`,
    );
    this.clientSecret = this.configurationService.getOrThrow<string>(
      `${prefix}.clientSecret`,
    );
    this.redirectUri = this.configurationService.getOrThrow<string>(
      `${prefix}.redirectUri`,
    );
    this.audience = this.configurationService.getOrThrow<string>(
      `${prefix}.audience`,
    );
    this.scope = this.configurationService.getOrThrow<string>(
      `${prefix}.scope`,
    );
  }

  getAuthorizationUrl(state: string): string {
    const url = new URL('/authorize', this.baseUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('scope', this.scope);
    url.searchParams.set('state', state);
    url.searchParams.set('audience', this.audience);

    return url.toString();
  }

  public async authenticateWithAuthorizationCode(
    code: string,
  ): Promise<Auth0Token> {
    const response = await this.auth0Api.exchangeAuthorizationCode({
      baseUri: this.baseUri,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      code,
      redirectUri: this.redirectUri,
    });
    const { access_token } = Auth0TokenResponseSchema.parse(response);
    return this.auth0TokenVerifier.verifyAndDecode(access_token);
  }
}
