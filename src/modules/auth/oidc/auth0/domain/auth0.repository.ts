// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import { IAuth0Api } from '@/modules/auth/oidc/auth0/datasources/auth0-api.interface';
import type { Auth0AuthenticationMethod } from '@/modules/auth/oidc/auth0/datasources/entities/auth0-authentication-method.entity';
import { Auth0TokenResponseSchema } from '@/modules/auth/oidc/auth0/datasources/entities/auth0-token-response.entity';
import type { IAuth0Repository } from '@/modules/auth/oidc/auth0/domain/auth0.repository.interface';
import { Auth0TokenVerifier } from '@/modules/auth/oidc/auth0/domain/auth0-token.verifier';
import type { Auth0Token } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';

@Injectable()
export class Auth0Repository implements IAuth0Repository {
  constructor(
    @Inject(IAuth0Api)
    private readonly auth0Api: IAuth0Api,
    private readonly auth0TokenVerifier: Auth0TokenVerifier,
  ) {}

  public getAuthorizationUrl(
    state: string,
    connection?: string,
    enroll?: boolean,
  ): string {
    return this.auth0Api.getAuthorizationUrl(state, connection, enroll);
  }

  public async authenticateWithAuthorizationCode(
    code: string,
  ): Promise<Auth0Token> {
    const response = await this.auth0Api.exchangeAuthorizationCode(code);
    const { id_token } = Auth0TokenResponseSchema.parse(response);
    return this.auth0TokenVerifier.verifyAndDecode(id_token);
  }

  public async listUserAuthenticationMethods(
    extUserId: string,
  ): Promise<Array<Auth0AuthenticationMethod>> {
    return await this.auth0Api.listUserAuthenticationMethods(extUserId);
  }

  public async deleteUserAuthenticationMethod(
    extUserId: string,
    methodId: string,
  ): Promise<void> {
    await this.auth0Api.deleteUserAuthenticationMethod(extUserId, methodId);
  }
}
