// SPDX-License-Identifier: FSL-1.1-MIT
import type { Auth0AuthenticationMethod } from '@/modules/auth/oidc/auth0/datasources/entities/auth0-authentication-method.entity';
import type { Auth0TokenResponse } from '@/modules/auth/oidc/auth0/datasources/entities/auth0-token-response.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const IAuth0Api = Symbol('IAuth0Api');

export interface IAuth0Api {
  /**
   * Builds the Auth0 authorization URL used to start the Authorization Code Flow.
   *
   * @param state - Opaque anti-CSRF state value that will be echoed back by Auth0.
   * @param connection - Optional Auth0 connection name to route directly to a specific identity provider.
   * @param enroll - When true, requests hosted enrollment of a new authenticator.
   * @returns The fully qualified Auth0 `/authorize` URL.
   */
  getAuthorizationUrl(
    state: string,
    connection?: string,
    enroll?: boolean,
  ): string;

  /**
   * Exchanges an OAuth 2.0 authorization code for Auth0 tokens.
   *
   * @param code - Authorization code received from the Auth0 callback.
   * @returns The raw Auth0 token response.
   */
  exchangeAuthorizationCode(code: string): Promise<Raw<Auth0TokenResponse>>;

  /**
   * Lists the MFA authentication methods (e.g. `totp`, `recovery-code`) of
   * the given user via the Auth0 Management API.
   *
   * @param extUserId - The Auth0 user identifier (`sub` claim).
   */
  listUserAuthenticationMethods(
    extUserId: string,
  ): Promise<Array<Auth0AuthenticationMethod>>;

  /**
   * Deletes a single MFA authentication method of the given user via the
   * Auth0 Management API.
   *
   * @param extUserId - The Auth0 user identifier (`sub` claim).
   * @param methodId - The authentication method identifier.
   */
  deleteUserAuthenticationMethod(
    extUserId: string,
    methodId: string,
  ): Promise<void>;
}
