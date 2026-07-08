// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { IAuth0Api } from '@/modules/auth/oidc/auth0/datasources/auth0-api.interface';
import type { Auth0TokenResponse } from '@/modules/auth/oidc/auth0/datasources/entities/auth0-token-response.entity';
import type { Raw } from '@/validation/entities/raw.entity';

@Injectable()
export class Auth0Api implements IAuth0Api {
  private static readonly AUTHORIZATION_CODE_GRANT_TYPE = 'authorization_code';
  private static readonly MULTI_FACTOR_ACR_VALUE =
    'http://schemas.openid.net/pape/policies/2007/06/multi-factor';
  private readonly baseUri: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly audience: string;
  private readonly scope: string;

  constructor(
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    const prefix = 'auth.auth0';
    const domain = this.configurationService.getOrThrow<string>(
      `${prefix}.domain`,
    );
    this.baseUri = `https://${domain}`;
    this.clientId = this.configurationService.getOrThrow<string>(
      `${prefix}.clientId`,
    );
    this.clientSecret = this.configurationService.getOrThrow<string>(
      `${prefix}.clientSecret`,
    );
    this.redirectUri = this.configurationService.getOrThrow<string>(
      `${prefix}.redirectUri`,
    );
    // Optional: without an audience Auth0 issues an opaque access token, but
    // the ID token (the only thing CGW consumes) is unaffected.
    this.audience =
      this.configurationService.get<string>(`${prefix}.audience`) ?? '';
    this.scope = this.configurationService.getOrThrow<string>(
      `${prefix}.scope`,
    );
  }

  public getAuthorizationUrl(
    state: string,
    connection?: string,
    elevate?: boolean,
  ): string {
    const url = new URL('/authorize', this.baseUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('scope', this.scope);
    url.searchParams.set('state', state);
    // An empty audience param makes Auth0 reject the request with 400.
    if (this.audience) {
      url.searchParams.set('audience', this.audience);
    }

    if (connection) {
      url.searchParams.set('connection', connection);
    }

    if (elevate) {
      // Step-up authentication: acr_values makes Auth0 require MFA for this
      // transaction. Deliberately NO max_age: the SSO session keeps covering
      // the first factor, so the user is challenged only for the second one.
      // Freshness is stamped server-side at the callback (mfa_verified_at).
      // https://auth0.com/docs/secure/multi-factor-authentication/step-up-authentication/configure-step-up-authentication-for-web-apps
      url.searchParams.set(
        'acr_values',
        Auth0Api.MULTI_FACTOR_ACR_VALUE,
      );
    }

    return url.toString();
  }

  public async exchangeAuthorizationCode(
    code: string,
  ): Promise<Raw<Auth0TokenResponse>> {
    try {
      const response = await this.networkService.postForm({
        url: new URL('/oauth/token', this.baseUri).toString(),
        data: {
          grant_type: Auth0Api.AUTHORIZATION_CODE_GRANT_TYPE,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri,
        },
      });

      return response.data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
