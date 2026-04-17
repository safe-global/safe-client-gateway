// SPDX-License-Identifier: FSL-1.1-MIT
import type { Hex } from 'viem';
import type { SiweMessage } from 'viem/siwe';

export const ISiweRepository = Symbol('ISiweRepository');

export interface ISiweRepository {
  generateNonce(): Promise<{ nonce: string }>;

  getValidatedSiweMessage(args: {
    message: string;
    signature: Hex;
  }): Promise<SiweMessage>;
}
