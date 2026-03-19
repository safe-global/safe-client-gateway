// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { Auth0TokenResponse } from '@/modules/auth/auth0/datasources/entities/auth0-token-response.entity';
import type { IAuth0Api } from '@/modules/auth/auth0/datasources/auth0-api.interface';
import type { Raw } from '@/validation/entities/raw.entity';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class Auth0Api implements IAuth0Api {
  private static readonly AUTHORIZATION_CODE_GRANT_TYPE = 'authorization_code';
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

  public getAuthorizationUrl(state: string): string {
    const url = new URL('/authorize', this.baseUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('scope', this.scope);
    url.searchParams.set('state', state);
    url.searchParams.set('audience', this.audience);

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
