// SPDX-License-Identifier: FSL-1.1-MIT
import { IAuth0Api } from '@/modules/auth/oidc/auth0/datasources/auth0-api.interface';
import type { IAuth0Repository } from '@/modules/auth/oidc/auth0/domain/auth0.repository.interface';
import { Inject, Injectable } from '@nestjs/common';
import { Auth0TokenVerifier } from '@/modules/auth/oidc/auth0/domain/auth0-token.verifier';
import type { Auth0Token } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';
import { Auth0TokenResponseSchema } from '@/modules/auth/oidc/auth0/datasources/entities/auth0-token-response.entity';

@Injectable()
export class Auth0Repository implements IAuth0Repository {
  constructor(
    @Inject(IAuth0Api)
    private readonly auth0Api: IAuth0Api,
    private readonly auth0TokenVerifier: Auth0TokenVerifier,
  ) {}

  public getAuthorizationUrl(state: string, connection?: string): string {
    return this.auth0Api.getAuthorizationUrl(state, connection);
  }

  public async authenticateWithAuthorizationCode(
    code: string,
  ): Promise<Auth0Token> {
    const response = await this.auth0Api.exchangeAuthorizationCode(code);
    const { access_token } = Auth0TokenResponseSchema.parse(response);
    return this.auth0TokenVerifier.verifyAndDecode(access_token);
  }
}
