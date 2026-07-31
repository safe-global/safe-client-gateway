// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type {
  AuthorizationUrlOptions,
  IAuth0Api,
} from '@/modules/auth/oidc/auth0/datasources/auth0-api.interface';
import {
  type Auth0AuthenticationMethod,
  Auth0AuthenticationMethodsSchema,
} from '@/modules/auth/oidc/auth0/datasources/entities/auth0-authentication-method.entity';
import type { Auth0TokenResponse } from '@/modules/auth/oidc/auth0/datasources/entities/auth0-token-response.entity';
import type { Raw } from '@/validation/entities/raw.entity';

const ManagementApiTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().int().positive(),
});

@Injectable()
export class Auth0Api implements IAuth0Api {
  private static readonly AUTHORIZATION_CODE_GRANT_TYPE = 'authorization_code';
  private static readonly CLIENT_CREDENTIALS_GRANT_TYPE = 'client_credentials';
  /**
   * OpenID Provider Authentication Policy Extension policy asserting that the
   * end user authenticated with more than one factor.
   */
  private static readonly MULTI_FACTOR_ACR_VALUE =
    'http://schemas.openid.net/pape/policies/2007/06/multi-factor';
  private readonly baseUri: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly audience: string;
  private readonly scope: string;
  private readonly managementApiTokenTtlBufferInSeconds: number;
  private inFlightManagementApiTokenRequest: Promise<string> | undefined;

  constructor(
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
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
    this.managementApiTokenTtlBufferInSeconds =
      this.configurationService.getOrThrow<number>(
        `${prefix}.managementApiTokenTtlBufferInSeconds`,
      );
  }

  public getAuthorizationUrl(
    state: string,
    options: AuthorizationUrlOptions = {},
  ): string {
    const url = new URL('/authorize', this.baseUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('scope', this.scope);
    url.searchParams.set('state', state);
    url.searchParams.set('audience', this.audience);

    if (options.connection) {
      url.searchParams.set('connection', options.connection);
    }

    if (options.enroll) {
      // Signals the tenant's post-login Action (via event.request.query) to
      // challenge an existing factor and then enroll a new authenticator on
      // the hosted pages.
      url.searchParams.set('ext-enroll-otp', 'true');
    }

    if (options.elevate) {
      // Step-up authentication. Measured on a dev tenant with
      // `mfa_policy = "all-applications"`: Auth0 honours this value on its own,
      // forcing a challenge even on a remembered browser, with no post-login
      // Action deployed. The Action in terraform-auth0-module is defence in
      // depth for the case where that policy is relaxed, since Auth0 otherwise
      // only surfaces the value to Actions as `event.transaction.acr_values`.
      // Either way the callback requires `amr` to prove a challenge really
      // happened, so a tenant that ignores this parameter fails closed.
      // https://auth0.com/docs/secure/multi-factor-authentication/step-up-authentication/configure-step-up-authentication-for-web-apps
      url.searchParams.set('acr_values', Auth0Api.MULTI_FACTOR_ACR_VALUE);
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

  private async getManagementApiToken(): Promise<string> {
    const cacheDir = CacheRouter.getAuth0ManagementApiTokenCacheDir();
    const cachedToken = await this.cacheService.hGet(cacheDir);

    if (cachedToken) {
      return cachedToken;
    }

    if (!this.inFlightManagementApiTokenRequest) {
      this.inFlightManagementApiTokenRequest =
        this.fetchManagementApiToken().finally(() => {
          this.inFlightManagementApiTokenRequest = undefined;
        });
    }

    return this.inFlightManagementApiTokenRequest;
  }

  /**
   * Fetches and caches a Management API access token via the Client Credentials
   * grant.
   *
   * Requires the Auth0 application to be authorized for the Management API
   * (audience `https://{domain}/api/v2/`) with at least the
   * `read:authentication_methods` and `delete:authentication_methods` scopes.
   */
  private async fetchManagementApiToken(): Promise<string> {
    const response = await this.networkService.postForm({
      url: new URL('/oauth/token', this.baseUri).toString(),
      data: {
        grant_type: Auth0Api.CLIENT_CREDENTIALS_GRANT_TYPE,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        audience: new URL('/api/v2/', this.baseUri).toString(),
      },
    });

    const { access_token, expires_in } = ManagementApiTokenResponseSchema.parse(
      response.data,
    );

    await this.cacheService.hSet(
      CacheRouter.getAuth0ManagementApiTokenCacheDir(),
      access_token,
      expires_in - this.managementApiTokenTtlBufferInSeconds,
      0,
    );

    return access_token;
  }
}
