import { SiweMessage } from '@/domain/auth/entities/siwe-message.entity';
import { JwtAccessTokenPayload } from '@/routes/auth/entities/jwt-access-token.payload.entity';
import { Request } from 'express';

export const IAuthRepository = Symbol('IAuthRepository');

export interface IAuthRepository {
  generateNonce(): Promise<{ nonce: string }>;

  verifyMessage(args: {
    message: SiweMessage;
    signature: `0x${string}`;
  }): Promise<{
    accessToken: string;
    tokenType: string;
    notBefore: number | null;
    expiresIn: number | null;
  }>;

  getAccessToken(request: Request, tokenType: string): string | null;

  verifyAccessToken(accessToken: string): JwtAccessTokenPayload;
}
