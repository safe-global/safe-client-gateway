// SPDX-License-Identifier: FSL-1.1-MIT
import { UnprocessableEntityException } from '@nestjs/common';
import type { Hex } from 'viem';

/**
 * Stable error code surfaced in the response body so the frontend can detect
 * an indeterminate simulation result and offer the user the choice to retry
 * the relay with `acceptUnverifiedSimulation: true`.
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
      message: `Relay simulation could not be completed: ${reason}. Retry with acceptUnverifiedSimulation=true to proceed anyway.`,
    });
  }
}
