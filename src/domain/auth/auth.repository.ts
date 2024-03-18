import { IAuthRepository } from '@/domain/auth/auth.repository.interface';
import { SiweMessage } from '@/domain/auth/entities/siwe-message.entity';
import { IAuthApi } from '@/domain/interfaces/auth-api.interface';
import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AuthRepository implements IAuthRepository {
  constructor(
    @Inject(IAuthApi)
    private readonly authApi: IAuthApi,
  ) {}

  generateNonce(): string {
    return this.authApi.generateNonce();
  }

  async verifyMessage(args: {
    address: `0x${string}`;
    message: SiweMessage;
    signature: `0x${string}`;
  }): Promise<boolean> {
    return this.authApi.verifyMessage(args);
  }

  /**
   * Extracts the access token from the request.
   *
   * @param request - the express request object
   * @param tokenType - the type of token used in the Authorization header
   * @returns the access token, or null if not found
   */
  getAccessToken(request: Request, tokenType: string): string | null {
    const header = request.headers.authorization;

    if (typeof header !== 'string') {
      return null;
    }

    const [type, token] = header.split(' ');

    if (type !== tokenType || !token) {
      return null;
    }

    return token;
  }
}
