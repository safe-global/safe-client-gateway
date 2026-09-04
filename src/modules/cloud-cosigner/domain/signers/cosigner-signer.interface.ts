// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';

export const ICosignerSigner = Symbol('ICosignerSigner');

/**
 * The key the cloud cosigner is registered under as a Safe owner. Two
 * implementations exist: a raw private key for development, and an AWS KMS
 * secp256k1 key for deployed environments.
 */
export interface ICosignerSigner {
  getAddress(): Promise<Address>;

  /**
   * Produces a 65-byte `r || s || v` EOA signature (v = 27 or 28) over a
   * 32-byte digest, i.e. the Safe transaction hash.
   */
  signHash(hash: Hex): Promise<Hex>;
}
