// SPDX-License-Identifier: FSL-1.1-MIT
import { UnprocessableEntityException } from '@nestjs/common';
import type { Hex } from 'viem';

export class SafeTxHashMismatchError extends UnprocessableEntityException {
  constructor(readonly safeTxHash: Hex) {
    super(
      `Safe transaction hash mismatch: provided hash ${safeTxHash} does not match the transaction data`,
    );
  }
}
