import { SiweMessage } from '@/domain/siwe/entities/siwe-message.entity';

export const IAuthApi = Symbol('IAuthApi');

export interface IAuthApi {
  generateNonce(): string;

  verifyMessage(args: {
    message: SiweMessage;
    signature: `0x${string}`;
  }): Promise<boolean>;

  cacheNonce(nonce: string): Promise<void>;

  getCachedNonce(nonce: string): Promise<string | undefined>;

  clearCachedNonce(nonce: string): Promise<void>;
}
