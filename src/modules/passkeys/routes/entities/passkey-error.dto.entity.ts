// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';

/** All error codes the passkeys API can emit. Documented as an enum so client
 * code generators produce a typed union. */
export const PASSKEY_ERROR_IDS = [
  'PASSKEY_NOT_CREATE_TYPE',
  'PASSKEY_RPID_NOT_ALLOWED',
  'PASSKEY_ORIGIN_NOT_ALLOWED',
  'PASSKEY_MALFORMED_ATTESTATION',
  'PASSKEY_UNSUPPORTED_KEY',
  'PASSKEY_RPID_MISMATCH',
  'PASSKEY_CHALLENGE_INVALID',
  'PASSKEY_ATTESTATION_INVALID',
  'PASSKEY_VERIFICATION_TIMEOUT',
  'PASSKEY_CONFLICT',
  'PASSKEY_CROSS_RP_CONFLICT',
  'PASSKEY_NOT_FOUND',
  'PASSKEY_INVALID_CREDENTIAL_ID',
  'PASSKEY_INTERNAL_ERROR',
] as const;

export type PasskeyErrorId = (typeof PASSKEY_ERROR_IDS)[number];

/**
 * Error envelope for the passkeys API.
 *
 * Superset of CGW's standard error envelope (`{ statusCode, message }`):
 * we add a stable, machine-readable `code` so generated typed clients can
 * switch on a known union without parsing `message`. The `statusCode` and
 * `message` fields keep the response shape compatible with the rest of CGW.
 */
export class PasskeyErrorResponse {
  @ApiProperty({ description: 'HTTP status code' })
  public readonly statusCode!: number;

  @ApiProperty({
    enum: PASSKEY_ERROR_IDS,
    description: 'Stable error identifier; never echoes library internals.',
  })
  public readonly code!: PasskeyErrorId;

  @ApiProperty({
    description:
      'Human-readable message. Opaque — do not parse for behaviour; switch on `code` instead.',
  })
  public readonly message!: string;
}
