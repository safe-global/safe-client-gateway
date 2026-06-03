// SPDX-License-Identifier: FSL-1.1-MIT
import { UnprocessableEntityException } from '@nestjs/common';
import type { Hex } from 'viem';

export const SIMULATION_FAILED_CODE = 'SIMULATION_FAILED';

export class RelaySimulationFailedError extends UnprocessableEntityException {
  readonly code = SIMULATION_FAILED_CODE;

  constructor(
    readonly safeTxHash: Hex | undefined,
    readonly reason?: string,
  ) {
    super({
      code: SIMULATION_FAILED_CODE,
      message: `Relay denied: transaction simulation failed${reason ? `: ${reason}` : ''}`,
    });
  }
}
