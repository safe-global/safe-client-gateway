import { CacheRouter } from '@/datasources/cache/cache.router';
import { IAuthRepository } from '@/domain/auth/auth.repository.interface';
import { SiweMessage } from '@/domain/auth/entities/siwe-message.entity';
import { IAuthApi } from '@/domain/interfaces/auth-api.interface';
import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';

@Injectable()
export class AuthRepository implements IAuthRepository {
  private readonly nonceTtlInSeconds: number;

  constructor(
    @Inject(IAuthApi)
    private readonly authApi: IAuthApi,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
  ) {
    this.nonceTtlInSeconds = this.configurationService.getOrThrow(
      'auth.nonceTtlSeconds',
    );
  }

  /**
   * Generates a unique nonce and stores it in cache for later verification.
   *
   * @returns nonce - unique string to be signed
   */
  async generateNonce(): Promise<{ nonce: string }> {
    const nonce = this.authApi.generateNonce();

    // Store nonce for reference to verify/prevent replay attacks
    const cacheDir = CacheRouter.getAuthNonceCacheDir(nonce);
    await this.cacheService.set(cacheDir, nonce, this.nonceTtlInSeconds);

    return {
      nonce,
    };
  }

  /**
   * Verifies that a message is valid according to its expiration date,
   * signature and nonce.
   *
   * @param args.message - SiWe message in object form
   * @param args.signature - signature from signing the message
   *
   * @returns boolean - whether the message is valid
   */
  async isAuthorized(args: {
    message: SiweMessage;
    signature: `0x${string}`;
  }): Promise<boolean> {
    const isExpired =
      !!args.message.expirationTime &&
      new Date(args.message.expirationTime) < new Date();

    const isValidSignature = await this.authApi
      .verifyMessage(args)
      // Don't prevent nonce from being deleted
      .catch(() => false);

    const cacheDir = CacheRouter.getAuthNonceCacheDir(args.message.nonce);
    const cachedNonce = await this.cacheService.get(cacheDir);
    const isValidNonce = cachedNonce === args.message.nonce;

    // Delete nonce from cache to prevent replay attacks
    await this.cacheService.deleteByKey(cacheDir.key);

    return !isExpired && isValidSignature && isValidNonce;
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
