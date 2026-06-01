// SPDX-License-Identifier: FSL-1.1-MIT
import { UnprocessableEntityException } from '@nestjs/common';
import type { Hex } from 'viem';

export class RelaySimulationFailedError extends UnprocessableEntityException {
  constructor(
    readonly safeTxHash: Hex | undefined,
    readonly reason?: string,
  ) {
    super(
      `Relay denied: transaction simulation failed${reason ? `: ${reason}` : ''}`,
    );
  }
}
