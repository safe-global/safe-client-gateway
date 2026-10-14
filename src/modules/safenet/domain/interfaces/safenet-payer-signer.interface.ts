// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';

export const ISafenetPayerSigner = Symbol('ISafenetPayerSigner');

export interface ISafenetPayerSigner {
  readonly address: Address;
  /** Signs a raw 32-byte digest with a 65-byte ECDSA signature (v = 27/28). */
  signHash(hash: Hex): Promise<Hex>;
}
