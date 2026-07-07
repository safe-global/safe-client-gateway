// SPDX-License-Identifier: FSL-1.1-MIT
import type { TransactionScanSupportedChain } from '@blockaid/client/resources/evm/evm';
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { IBlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';
import { getBlockaidChainName } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-chain-mapping';

type CachedVerdict = 'malicious' | 'safe';

@Injectable()
export class MaliciousAddressScanner {
  private readonly maxBatchSize: number;
  private readonly cacheTtlSeconds: number;

  constructor(
    @Inject(IBlockaidApi) private readonly blockaidApi: IBlockaidApi,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.maxBatchSize = this.configurationService.getOrThrow<number>(
      'safeShield.maliciousAddressScan.maxBatchSize',
    );
    this.cacheTtlSeconds = this.configurationService.getOrThrow<number>(
      'safeShield.maliciousAddressScan.cacheTtlSeconds',
    );
  }

  async getMaliciousAddresses(
    chainId: string,
    addresses: Array<string>,
  ): Promise<Set<string>> {
    const chain = getBlockaidChainName(chainId);
    if (!(chain && addresses.length)) return new Set();

    const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
    const malicious = new Set<string>();
    const toScan: Array<string> = [];

    await Promise.all(
      unique.map(async (address) => {
        const cached = await this.readCache(chainId, address);
        if (cached === 'malicious') malicious.add(address);
        else if (cached === null) toScan.push(address);
      }),
    );

    for (let i = 0; i < toScan.length; i += this.maxBatchSize) {
      const batch = toScan.slice(i, i + this.maxBatchSize);
      const verdicts = await this.scan(chain, batch);
      await Promise.all(
        batch.map(async (address) => {
          const isMalicious = verdicts.get(address);
          if (isMalicious === undefined) return;
          if (isMalicious) malicious.add(address);
          await this.writeCache(
            chainId,
            address,
            isMalicious ? 'malicious' : 'safe',
          );
        }),
      );
    }

    return malicious;
  }

  private async scan(
    chain: TransactionScanSupportedChain,
    addresses: Array<string>,
  ): Promise<Map<string, boolean>> {
    try {
      const response = await this.blockaidApi.scanAddressBulk(chain, addresses);
      return new Map(
        Object.entries(response).map(([address, verdict]) => [
          address.toLowerCase(),
          verdict === 'Malicious',
        ]),
      );
    } catch (error) {
      this.loggingService.warn(
        `Blockaid owners scan failed open on chain ${chain}: ${asError(error)}`,
      );
      return new Map();
    }
  }

  private async readCache(
    chainId: string,
    address: string,
  ): Promise<CachedVerdict | null> {
    try {
      const cached = await this.cacheService.hGet(
        CacheRouter.getMaliciousAddressScanCacheDir({ chainId, address }),
      );
      return cached === 'malicious' || cached === 'safe' ? cached : null;
    } catch {
      // Cache is best-effort.
      return null;
    }
  }

  private async writeCache(
    chainId: string,
    address: string,
    verdict: CachedVerdict,
  ): Promise<void> {
    try {
      await this.cacheService.hSet(
        CacheRouter.getMaliciousAddressScanCacheDir({ chainId, address }),
        verdict,
        this.cacheTtlSeconds,
      );
    } catch {
      // Cache is best-effort.
    }
  }
}
