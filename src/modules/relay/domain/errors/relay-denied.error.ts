// SPDX-License-Identifier: FSL-1.1-MIT
import { ForbiddenException } from '@nestjs/common';
import type { Address } from 'viem';

export class RelayDeniedError extends ForbiddenException {
  constructor(
    readonly address: Address,
    readonly reason?: string,
  ) {
    super(`Relay denied for ${address}${reason ? `: ${reason}` : ''}`);
  }
}
