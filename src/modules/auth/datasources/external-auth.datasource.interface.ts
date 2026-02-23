export const IExternalAuthDatasource = Symbol('IExternalAuthDatasource');

export interface ExternalAuthUser {
  /** Stable user ID from the external auth provider. */
  externalId: string;
  email: string;
  emailVerified: boolean;
}

export interface IExternalAuthDatasource {
  /**
   * Returns an authorization URL the browser should redirect the user to.
   * The URL includes the given `state` and `redirectUri` so the provider can
   * return the user to the correct callback endpoint after consent.
   */
  getOAuthAuthorizationUrl(args: {
    provider: 'google' | 'microsoft';
    clientId: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    redirectUri: string;
    state: string;
  }): Promise<string>;

  /**
   * Exchanges a short-lived authorization `code` for the authenticated user's
   * profile. Throws `UnauthorizedException` for invalid or expired codes.
   */
  exchangeOAuthCode(args: {
    code: string;
    redirectUri: string;
  }): Promise<ExternalAuthUser>;
}
