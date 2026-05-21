// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Input for {@link PasskeyAttestationService.verify}. All byte-valued fields
 * are base64url-encoded at this boundary; decoding is the verifier's job.
 */
export interface VerifyAttestationInput {
  rpId: string;
  origin: string;
  attestationObject: string; // base64url
  clientDataJSON: string; // base64url
  challenge: string; // base64url; client-supplied, server-recomputable
  /**
   * Recomputes the expected challenge for this request. The verifier uses a
   * constant-time comparison against the WebAuthn `challenge` from
   * clientDataJSON. Returning `null` (or throwing) signals that no
   * server-recomputable challenge can be derived for this input.
   */
  expectedChallenge: () => string;
}
