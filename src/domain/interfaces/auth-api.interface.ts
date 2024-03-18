import { SiweMessage } from '@/domain/auth/entities/siwe-message.entity';

export const IAuthApi = Symbol('IAuthApi');

export interface IAuthApi {
  generateNonce(): string;

  verifyMessage(args: {
    address: `0x${string}`;
    message: SiweMessage;
    signature: `0x${string}`;
  }): Promise<boolean>;
}
