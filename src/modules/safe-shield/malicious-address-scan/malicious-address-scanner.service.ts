// SPDX-License-Identifier: FSL-1.1-MIT
import Blockaid from '@blockaid/client';
import type { TransactionScanSupportedChain } from '@blockaid/client/resources/evm/evm';
import { Inject, Injectable } from '@nestjs/common';
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
import { getBlockaidChainName } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-chain-mapping';
import { BlockaidClient } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-client.provider';

const SCAN_TIMEOUT_MS = 1500;
const MAX_BATCH = 100;
const CACHE_TTL_SECONDS = 300;
const SCAN_DOMAIN = 'safe.global';

type CachedVerdict = 'malicious' | 'safe';

@Injectable()
export class MaliciousAddressScanner {
  constructor(
    @Inject(BlockaidClient) private readonly client: Blockaid,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async getMaliciousAddresses(
    chainId: string,
    addresses: Array<string>,
  ): Promise<Set<string>> {
    const chain = getBlockaidChainName(chainId);
    if (!chain || addresses.length === 0) return new Set();

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

    for (let i = 0; i < toScan.length; i += MAX_BATCH) {
      const batch = toScan.slice(i, i + MAX_BATCH);
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
      const response = await this.client.evm.addressBulk.scan(
        { addresses, chain, metadata: { domain: SCAN_DOMAIN } },
        { timeout: SCAN_TIMEOUT_MS, maxRetries: 0 },
      );
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
        CACHE_TTL_SECONDS,
      );
    } catch {
      // Cache is best-effort.
    }
  }
}
