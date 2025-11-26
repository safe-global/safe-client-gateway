import type { SiweMessage } from 'viem/siwe';
import type { Hex } from 'viem';

export const ISiweRepository = Symbol('ISiweRepository');

export interface ISiweRepository {
  generateNonce(): Promise<{ nonce: string }>;

  getValidatedSiweMessage(args: {
    message: string;
    signature: Hex;
  }): Promise<SiweMessage>;
}
