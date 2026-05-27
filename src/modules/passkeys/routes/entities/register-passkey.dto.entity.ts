// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

const RP_ID = /^[A-Za-z0-9.-]+$/;
const VERIFIERS_HEX = /^0x[0-9a-fA-F]{44}$/;

// Per-field caps are sized to realistic worst-case attestations:
//   - attestationObject: ~10 KiB for `tpm` with cert chain; 16 KiB ceiling.
//   - clientDataJSON: 200–400 B in practice; 2 KiB ceiling.
// The summed JSON envelope stays under the 24 KiB body cap enforced by the
// route-scoped raw-body limit. These DTO caps are a defence-in-depth layer in
// case the body cap is bypassed by a future framework-default change.
const ATTESTATION_OBJECT_MAX = 16 * 1024;
const CLIENT_DATA_JSON_MAX = 2 * 1024;

export const RegisterPasskeySchema = z.object({
  rpId: z.string().min(1).max(253).regex(RP_ID),
  attestationObject: z.base64url().min(1).max(ATTESTATION_OBJECT_MAX),
  clientDataJSON: z.base64url().min(1).max(CLIENT_DATA_JSON_MAX),
  // P256.Verifiers (uint176, 22 bytes). Lower 20 bytes = FCL fallback verifier
  // address; upper 2 bytes = on-chain precompile address (RIP-7212). NOT an
  // Ethereum address — no EIP-55 checksum applies. Lowercased on the wire.
  verifiers: z.string().regex(VERIFIERS_HEX),
  // The origin allowlist in the service is the load-bearing check, but URL
  // parsing here strips control characters / whitespace / non-URL strings at
  // the framework boundary as defense-in-depth.
  origin: z.url().min(1).max(512),
  challenge: z.base64url().min(1).max(256),
});

export type RegisterPasskeyDto = z.infer<typeof RegisterPasskeySchema>;

export class RegisterPasskeyDtoEntity {
  @ApiProperty({
    description: 'WebAuthn Relying Party ID (DNS label).',
    example: 'app.safe.global',
    maxLength: 253,
  })
  public readonly rpId!: string;

  @ApiProperty({
    description: 'base64url-encoded WebAuthn attestation object (CBOR).',
    maxLength: ATTESTATION_OBJECT_MAX,
  })
  public readonly attestationObject!: string;

  @ApiProperty({
    description: 'base64url-encoded WebAuthn clientDataJSON.',
    maxLength: CLIENT_DATA_JSON_MAX,
  })
  public readonly clientDataJSON!: string;

  @ApiProperty({
    description:
      'P256.Verifiers packed uint176 as 0x-prefixed lowercase 44-char hex (NOT an Ethereum address).',
    example: `0x${'0'.repeat(44)}`,
    pattern: '^0x[0-9a-f]{44}$',
  })
  public readonly verifiers!: string;

  @ApiProperty({
    description:
      'Origin the WebAuthn ceremony ran in (must be in PASSKEYS_ORIGIN_ALLOWLIST).',
    example: 'https://app.safe.global',
    maxLength: 512,
  })
  public readonly origin!: string;

  @ApiProperty({
    description:
      'base64url-encoded challenge. Stateless: must be a server-recomputable value.',
    maxLength: 256,
  })
  public readonly challenge!: string;
}
