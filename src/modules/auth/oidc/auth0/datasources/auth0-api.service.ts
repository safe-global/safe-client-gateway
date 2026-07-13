// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { IAuth0Api } from '@/modules/auth/oidc/auth0/datasources/auth0-api.interface';
import {
  type Auth0AuthenticationMethod,
  Auth0AuthenticationMethodsSchema,
} from '@/modules/auth/oidc/auth0/datasources/entities/auth0-authentication-method.entity';
import type { Auth0TokenResponse } from '@/modules/auth/oidc/auth0/datasources/entities/auth0-token-response.entity';
import type { Raw } from '@/validation/entities/raw.entity';

const ManagementApiTokenResponseSchema = z.object({
  access_token: z.string(),
});

@Injectable()
export class Auth0Api implements IAuth0Api {
  private static readonly AUTHORIZATION_CODE_GRANT_TYPE = 'authorization_code';
  private static readonly CLIENT_CREDENTIALS_GRANT_TYPE = 'client_credentials';
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
    this.audience = this.configurationService.getOrThrow<string>(
      `${prefix}.audience`,
    );
    this.scope = this.configurationService.getOrThrow<string>(
      `${prefix}.scope`,
    );
  }

  public getAuthorizationUrl(
    state: string,
    connection?: string,
    enroll?: boolean,
  ): string {
    const url = new URL('/authorize', this.baseUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('scope', this.scope);
    url.searchParams.set('state', state);
    url.searchParams.set('audience', this.audience);

    if (connection) {
      url.searchParams.set('connection', connection);
    }

    if (enroll) {
      // Signals the tenant's post-login Action (via event.request.query) to
      // challenge an existing factor and then enroll a new authenticator on
      // the hosted pages.
      url.searchParams.set('ext-enroll-otp', 'true');
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

  public async listUserAuthenticationMethods(
    extUserId: string,
  ): Promise<Array<Auth0AuthenticationMethod>> {
    try {
      const accessToken = await this.getManagementApiToken();
      const response = await this.networkService.get({
        url: this.getAuthenticationMethodsUrl(extUserId),
        networkRequest: {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      });
      return Auth0AuthenticationMethodsSchema.parse(response.data);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }


  public async deleteUserAuthenticationMethod(
    extUserId: string,
    methodId: string,
  ): Promise<void> {
    try {
      const accessToken = await this.getManagementApiToken();
      await this.networkService.delete({
        url: `${this.getAuthenticationMethodsUrl(extUserId)}/${encodeURIComponent(methodId)}`,
        networkRequest: {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  private getAuthenticationMethodsUrl(extUserId: string): string {
    return new URL(
      `/api/v2/users/${encodeURIComponent(extUserId)}/authentication-methods`,
      this.baseUri,
    ).toString();
  }

  /**
   * Fetches a Management API access token via the Client Credentials grant.
   *
   * Requires the Auth0 application to be authorized for the Management API
   * (audience `https://{domain}/api/v2/`) with at least the
   * `read:authentication_methods` and `delete:authentication_methods` scopes.
   *
   * Note: the token is fetched per request (no caching) — acceptable for a
   * spike, should be cached before production use.
   */
  private async getManagementApiToken(): Promise<string> {
    const response = await this.networkService.postForm({
      url: new URL('/oauth/token', this.baseUri).toString(),
      data: {
        grant_type: Auth0Api.CLIENT_CREDENTIALS_GRANT_TYPE,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        audience: new URL('/api/v2/', this.baseUri).toString(),
      },
    });

    return ManagementApiTokenResponseSchema.parse(response.data).access_token;
  }
}
