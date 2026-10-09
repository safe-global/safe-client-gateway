// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { MAX_TTL } from '@/datasources/cache/constants';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { SafePolicyGuardAbi } from '@/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import { type Raw, rawify } from '@/validation/entities/raw.entity';

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
    const cacheDir = CacheRouter.getSafePolicyGuardExpiryCacheDir(args);
    const cached = await this.cacheService.hGet(cacheDir);

    if (cached !== null) {
      return rawify(cached);
    }

    const client = await this.blockchainApiManager.getApi(args.chainId);
    const expiry = await client.readContract({
      address: args.guard,
      abi: SafePolicyGuardAbi,
      functionName: 'EXPIRY',
    });
    const value = expiry.toString();

    await this.cacheService.hSet(cacheDir, value, MAX_TTL);

    return rawify(value);
  }
}
