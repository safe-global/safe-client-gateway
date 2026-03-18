// SPDX-License-Identifier: FSL-1.1-MIT
import type { Auth0TokenResponse } from '@/modules/auth/auth0/datasources/entities/auth0-token-response.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const IAuth0Api = Symbol('IAuth0Api');

export interface IAuth0Api {
  /**
   * Exchanges an OAuth 2.0 authorization code for Auth0 tokens.
   *
   * @param args - Auth0 tenant and client credentials plus the received authorization code.
   * @returns The raw Auth0 token response.
   */
  exchangeAuthorizationCode(args: {
    baseUri: string;
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
  }): Promise<Raw<Auth0TokenResponse>>;
}
