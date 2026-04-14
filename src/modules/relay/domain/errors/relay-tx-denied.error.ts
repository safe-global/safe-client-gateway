// SPDX-License-Identifier: FSL-1.1-MIT
import { ForbiddenException } from '@nestjs/common';
import type { Hex } from 'viem';

export class RelayTxDeniedError extends ForbiddenException {
  constructor(
    readonly safeTxHash: Hex,
    readonly reason?: string,
  ) {
    super(
      `Relay denied for safe transaction hash ${safeTxHash}${reason ? `: ${reason}` : ''}`,
    );
  }
}
