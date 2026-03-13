/**
 * Decoded payload from a verified Auth0 access token.
 * Standard JWT claims (exp, nbf, iat) are transformed from
 * numeric timestamps to Date instances by the JWT decode layer.
 */
export type Auth0DecodedToken = {
  sub: string;
  exp?: Date;
  nbf?: Date;
  iat?: Date;
};

export const IAuth0Service = Symbol('IAuth0Service');

export interface IAuth0Service {
  /**
   * Verifies an Auth0 access token by checking its signature, issuer, and audience.
   *
   * @param accessToken - JWT access token issued by Auth0.
   * @returns The decoded token payload containing the `sub` claim.
   * @throws If the token is invalid, expired, or fails verification.
   */
  verifyAndDecode(accessToken: string): Auth0DecodedToken;
}
