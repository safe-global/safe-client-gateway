// SPDX-License-Identifier: FSL-1.1-MIT
import type { Auth0AuthenticationMethod } from '@/modules/auth/oidc/auth0/datasources/entities/auth0-authentication-method.entity';
import type { Auth0Token } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';

export const IAuth0Repository = Symbol('IAuth0Repository');

export interface IAuth0Repository {
  /**
   * Builds the Auth0 authorization URL used to start the Authorization Code Flow.
   *
   * @param state - Opaque anti-CSRF state value that will be echoed back by Auth0.
   * @param connection - Optional OIDC connection name to route directly to a specific identity provider.
   * @param enroll - When true, requests hosted enrollment of a new authenticator.
   * @returns The fully qualified Auth0 `/authorize` URL.
   */
  getAuthorizationUrl(
    state: string,
    connection?: string,
    enroll?: boolean,
  ): string;

  /**
   * Authenticates an Auth0 authorization code and returns the verified token claims.
   *
   * @param code - Authorization code received from the Auth0 callback.
   * @returns The decoded Auth0 token with claims.
   */
  authenticateWithAuthorizationCode(code: string): Promise<Auth0Token>;

  /**
   * Lists the MFA authentication methods (e.g. `totp`, `recovery-code`) of
   * the given Auth0 user.
   *
   * @param extUserId - The Auth0 user identifier (`sub` claim).
   */
  listUserAuthenticationMethods(
    extUserId: string,
  ): Promise<Array<Auth0AuthenticationMethod>>;

  /**
   * Deletes a single MFA authentication method of the given Auth0 user.
   *
   * @param extUserId - The Auth0 user identifier (`sub` claim).
   * @param methodId - The authentication method identifier.
   */
  deleteUserAuthenticationMethod(
    extUserId: string,
    methodId: string,
  ): Promise<void>;
}
