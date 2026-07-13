// SPDX-License-Identifier: FSL-1.1-MIT
import type { Auth0Token } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';

export const IAuth0Repository = Symbol('IAuth0Repository');

export interface IAuth0Repository {
  /**
   * Builds the Auth0 authorization URL used to start the Authorization Code Flow.
   *
   * @param state - Opaque anti-CSRF state value that will be echoed back by Auth0.
   * @param connection - Optional OIDC connection name to route directly to a specific identity provider.
   * @param prompt - Optional OIDC prompt value (`login` forces re-authentication).
   * @returns The fully qualified Auth0 `/authorize` URL.
   */
  getAuthorizationUrl(
    state: string,
    connection?: string,
    prompt?: string,
  ): string;

  /**
   * Authenticates an Auth0 authorization code and returns the verified token claims.
   *
   * @param code - Authorization code received from the Auth0 callback.
   * @returns The decoded Auth0 token with claims.
   */
  authenticateWithAuthorizationCode(code: string): Promise<Auth0Token>;

  /**
   * Deletes all MFA authentication methods of the given Auth0 user so that
   * the next login triggers a fresh authenticator enrollment.
   *
   * @param extUserId - The Auth0 user identifier (`sub` claim).
   */
  deleteUserAuthenticationMethods(extUserId: string): Promise<void>;
}
