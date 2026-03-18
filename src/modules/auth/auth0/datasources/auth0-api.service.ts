// SPDX-License-Identifier: FSL-1.1-MIT
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

  private static readonly FORM_URLENCODED_CONTENT_TYPE_HEADER = {
    'content-type': 'application/x-www-form-urlencoded',
  };

  constructor(
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {}

  public async exchangeAuthorizationCode(args: {
    baseUri: string;
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
  }): Promise<Raw<Auth0TokenResponse>> {
    try {
      const response = await this.networkService.post({
        url: new URL('/oauth/token', args.baseUri).toString(),
        data: {
          grant_type: Auth0Api.AUTHORIZATION_CODE_GRANT_TYPE,
          client_id: args.clientId,
          client_secret: args.clientSecret,
          code: args.code,
          redirect_uri: args.redirectUri,
        },
        networkRequest: {
          headers: { ...Auth0Api.FORM_URLENCODED_CONTENT_TYPE_HEADER },
        },
      });

      return response.data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
