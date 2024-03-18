import { SiweMessage } from '@/domain/auth/entities/siwe-message.entity';
import { Request } from 'express';

export const IAuthRepository = Symbol('IAuthRepository');

export interface IAuthRepository {
  generateNonce(): string;

  verifyMessage(args: {
    message: SiweMessage;
    signature: `0x${string}`;
  }): Promise<boolean>;

  getAccessToken(request: Request, tokenType: string): string | null;
}
