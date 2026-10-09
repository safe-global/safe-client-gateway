// SPDX-License-Identifier: FSL-1.1-MIT
import type { Hex } from 'viem';

/**
 * No payer transaction from this call can have paid the fee: nothing was relayed, the relay
 * rejected or reverted it, or the observed receipt reverted.
 */
export class SafenetPayerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SafenetPayerError';
  }
}

export type SafenetPayerUnresolvedDetails = {
  taskId: string;
  payerNonce: bigint;
  transactionHash?: Hex;
};

/** The fee may have been paid: check the payer Safe nonce and events on chain before proposing. */
export class SafenetPayerUnresolvedError extends Error {
  constructor(
    message: string,
    readonly details: SafenetPayerUnresolvedDetails,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'SafenetPayerUnresolvedError';
  }
}
