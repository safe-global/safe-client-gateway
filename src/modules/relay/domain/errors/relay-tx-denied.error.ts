// SPDX-License-Identifier: FSL-1.1-MIT
import { ForbiddenException } from '@nestjs/common';
import type { Hex } from 'viem';

export class RelayTxDeniedError extends ForbiddenException {
  constructor(
    readonly safeTxHash: Hex | undefined,
    readonly reason?: string,
  ) {
    super(
      safeTxHash
        ? `Relay denied for safe transaction hash ${safeTxHash}${reason ? `: ${reason}` : ''}`
        : `Relay denied: no safe transaction hash provided`,
    );
  }
}
