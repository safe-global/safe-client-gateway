// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, UnprocessableEntityException } from '@nestjs/common';
import type { Hex } from 'viem';

/**
 * Stable error code surfaced in the response body so the frontend can detect
 * an indeterminate simulation result.
 */
export const INDETERMINATE_SIMULATION_CODE = 'INDETERMINATE_SIMULATION';

export class RelaySimulationIndeterminateError extends UnprocessableEntityException {
  readonly code = INDETERMINATE_SIMULATION_CODE;

  constructor(
    readonly safeTxHash: Hex | undefined,
    readonly reason: string,
  ) {
    super({
      code: INDETERMINATE_SIMULATION_CODE,
      message: 'Relay simulation could not be completed.',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
