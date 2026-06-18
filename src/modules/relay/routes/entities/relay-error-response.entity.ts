// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';

/**
 * Stable `code` values surfaced in the 422 body so the frontend can branch
 * on them. New codes can be added here without touching call sites.
 */
export const RELAY_ERROR_CODES = [
  'SIMULATION_FAILED',
  'INDETERMINATE_SIMULATION',
] as const;
export type RelayErrorCode = (typeof RELAY_ERROR_CODES)[number];

export class RelayErrorResponse {
  @ApiProperty({
    enum: RELAY_ERROR_CODES,
    description:
      'Stable identifier of the error condition. The frontend MUST branch on this value (not on `message`, which is informational and may change).',
  })
  code: RelayErrorCode;

  @ApiProperty({
    description:
      'Human-readable description of the error. Informational only; do not parse.',
  })
  message: string;

  @ApiProperty({ example: 422 })
  statusCode: number;

  constructor(args: {
    code: RelayErrorCode;
    message: string;
    statusCode: number;
  }) {
    this.code = args.code;
    this.message = args.message;
    this.statusCode = args.statusCode;
  }
}
