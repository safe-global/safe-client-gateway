import { SiweMessage } from '@/domain/siwe/entities/siwe-message.entity';

export const ISiweApi = Symbol('ISiweApi');

export interface ISiweApi {
  generateNonce(): string;

  verifyMessage(args: {
    message: SiweMessage;
    signature: `0x${string}`;
  }): Promise<boolean>;

  storeNonce(nonce: string): Promise<void>;

  getNonce(nonce: string): Promise<string | undefined>;

  clearNonce(nonce: string): Promise<void>;
}
