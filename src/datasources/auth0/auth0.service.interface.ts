import type { Auth0Token } from '@/datasources/auth0/entities/auth0-token.entity';

export const IAuth0Service = Symbol('IAuth0Service');

export interface IAuth0Service {
  /**
   * Verifies an Auth0 access token by checking its signature, issuer, and audience.
   *
   * @param accessToken - JWT access token issued by Auth0.
   * @returns The decoded token payload containing the `sub` claim.
   * @throws If the token is invalid, expired, or fails verification.
   */
  verifyAndDecode(accessToken: string): Auth0Token;
}
