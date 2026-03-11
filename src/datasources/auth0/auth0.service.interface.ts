export const IAuth0Service = Symbol('IAuth0Service');

export interface IAuth0Service {
  /**
   * Verifies an Auth0 access token by checking its signature, issuer, and audience.
   *
   * @param accessToken - JWT access token issued by Auth0.
   * @throws If the token is invalid, expired, or fails verification.
   */
  verify(accessToken: string): void;
}
