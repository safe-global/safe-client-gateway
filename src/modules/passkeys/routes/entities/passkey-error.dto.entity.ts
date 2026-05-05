// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';

/** All error codes the passkeys API can emit. Documented as an enum so client
 * code generators produce a typed union. */
export const PASSKEY_ERROR_IDS = [
  'PASSKEY_NOT_CREATE_TYPE',
  'PASSKEY_RPID_NOT_ALLOWED',
  'PASSKEY_ORIGIN_NOT_ALLOWED',
  'PASSKEY_VERIFIERS_NOT_ALLOWED',
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

export class PasskeyErrorResponse {
  @ApiProperty({
    enum: PASSKEY_ERROR_IDS,
    description: 'Stable error identifier; never echoes library internals.',
  })
  public readonly code!: PasskeyErrorId;

  @ApiProperty({
    description:
      'Human-readable message. Opaque — do not parse for behaviour; switch on `code` instead.',
    required: false,
  })
  public readonly message?: string;
}
