// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { CacheRouter } from '#/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '#/datasources/cache/cache.service.interface';
import { MAX_TTL } from '#/datasources/cache/constants';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { IBlockchainApiManager } from '#/domain/interfaces/blockchain-api.manager.interface';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import { SafePolicyGuardAbi } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import { type Raw, rawify } from '#/validation/entities/raw.entity';

/**
 * Reads values from a `SafePolicyGuard` contract on-chain.
 */
@Injectable()
export class SafePolicyGuardApi {
  constructor(
    @Inject(IBlockchainApiManager)
    private readonly blockchainApiManager: IBlockchainApiManager,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {}

  /**
   * The guard's `EXPIRY()`, as a decimal string.
   *
   * The value is fixed when the guard is deployed, so it is cached without an
   * expiry rather than for a configured time.
   */
  public async getExpiry(args: {
    chainId: string;
    guard: Address;
  }): Promise<Raw<string>> {
    return await this.readImmutable({ ...args, name: 'EXPIRY' });
  }

  public async getDelay(args: {
    chainId: string;
    guard: Address;
  }): Promise<Raw<string>> {
    return await this.readImmutable({ ...args, name: 'DELAY' });
  }

  /** Immutable per deployment, so cached with no TTL. */
  private async readImmutable(args: {
    chainId: string;
    guard: Address;
    name: 'DELAY' | 'EXPIRY';
  }): Promise<Raw<string>> {
    const cacheDir = CacheRouter.getSafePolicyGuardCacheDir(args);
    const cached = await this.cacheService.hGet(cacheDir);

    if (cached !== null) {
      return rawify(cached);
    }

    let value: string;
    try {
      const client = await this.blockchainApiManager.getApi(args.chainId);
      const seconds = await client.readContract({
        address: args.guard,
        abi: SafePolicyGuardAbi,
        functionName: args.name,
      });
      value = seconds.toString();
    } catch (error) {
      this.loggingService.warn({
        message: `Could not read the ${args.name} of a SafePolicyGuard`,
        chainId: args.chainId,
        guard: args.guard,
        error: asError(error).message,
      });
      throw this.httpErrorFactory.from(error);
    }

    await this.cacheService.hSet(cacheDir, value, MAX_TTL);

    return rawify(value);
  }
}
