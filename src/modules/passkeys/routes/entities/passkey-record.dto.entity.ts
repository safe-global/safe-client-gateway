// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';

/**
 * Wire shape for both POST (created/identical) and GET (hit) responses.
 *
 * Encoding contract:
 *   - credentialId: base64url, no padding
 *   - x, y:         0x-prefixed lowercase 64-char hex
 *   - verifiers:    0x-prefixed lowercase 44-char hex (uint176, NOT an address)
 *   - rpId:         DNS label
 *   - createdAt:    RFC 3339 / ISO 8601 (UTC)
 */
export class PasskeyRecordResponse {
  @ApiProperty({
    description: 'Credential ID, base64url-encoded (no padding).',
  })
  public readonly credentialId!: string;

  @ApiProperty({
    description:
      'P-256 X coordinate, 0x-prefixed lowercase 64-char hex (32 bytes).',
    pattern: '^0x[0-9a-f]{64}$',
  })
  public readonly x!: string;

  @ApiProperty({
    description:
      'P-256 Y coordinate, 0x-prefixed lowercase 64-char hex (32 bytes).',
    pattern: '^0x[0-9a-f]{64}$',
  })
  public readonly y!: string;

  @ApiProperty({
    description:
      'P256.Verifiers packed uint176 as 0x-prefixed lowercase 44-char hex.',
    pattern: '^0x[0-9a-f]{44}$',
  })
  public readonly verifiers!: string;

  @ApiProperty({ description: 'WebAuthn Relying Party ID.' })
  public readonly rpId!: string;

  @ApiProperty({
    description: 'Server-assigned creation timestamp (ISO 8601, UTC).',
    format: 'date-time',
  })
  public readonly createdAt!: string;
}
