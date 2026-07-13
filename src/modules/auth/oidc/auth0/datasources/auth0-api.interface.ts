// SPDX-License-Identifier: FSL-1.1-MIT
import type { Auth0TokenResponse } from '@/modules/auth/oidc/auth0/datasources/entities/auth0-token-response.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const IAuth0Api = Symbol('IAuth0Api');

export interface IAuth0Api {
  /**
   * Builds the Auth0 authorization URL used to start the Authorization Code Flow.
   *
   * @param state - Opaque anti-CSRF state value that will be echoed back by Auth0.
   * @param connection - Optional Auth0 connection name to route directly to a specific identity provider.
   * @param prompt - Optional OIDC prompt value (`login` forces re-authentication).
   * @returns The fully qualified Auth0 `/authorize` URL.
   */
  getAuthorizationUrl(
    state: string,
    connection?: string,
    prompt?: string,
  ): string;

  /**
   * Exchanges an OAuth 2.0 authorization code for Auth0 tokens.
   *
   * @param code - Authorization code received from the Auth0 callback.
   * @returns The raw Auth0 token response.
   */
  exchangeAuthorizationCode(code: string): Promise<Raw<Auth0TokenResponse>>;

  /**
   * Deletes all authentication methods (MFA enrollments, including TOTP and
   * the recovery code) of the given user via the Auth0 Management API.
   *
   * On the next login, Auth0's MFA policy prompts the user to enroll a new
   * authenticator from scratch.
   *
   * @param extUserId - The Auth0 user identifier (`sub` claim).
   */
  deleteUserAuthenticationMethods(extUserId: string): Promise<void>;
}
