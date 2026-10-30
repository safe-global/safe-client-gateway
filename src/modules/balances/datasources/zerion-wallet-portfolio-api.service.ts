// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { ZodError } from 'zod';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { CacheRouter } from '#/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '#/datasources/cache/cache.service.interface';
import type { CacheDir } from '#/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import {
  type INetworkService,
  NetworkService,
} from '#/datasources/network/network.service.interface';
import { LogType } from '#/domain/common/entities/log-type.entity';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import {
  type ZerionWalletPortfolio,
  ZerionWalletPortfolioSchema,
  type ZerionWalletPortfolioSnapshot,
  ZerionWalletPortfolioSnapshotSchema,
} from '#/modules/balances/datasources/entities/zerion-wallet-portfolio.entity';
import { getZerionHeaders } from '#/modules/balances/datasources/zerion-api.helpers';
import type { WalletPortfolioIdentity } from '#/modules/balances/domain/entities/wallet-portfolio-identity.entity';
import { ZerionRateLimiter } from '#/modules/zerion/datasources/zerion-rate-limiter.service';
import { type Raw, rawify } from '#/validation/entities/raw.entity';

const SnapshotTimestampsSchema = ZerionWalletPortfolioSnapshotSchema.pick({
  fetchedAt: true,
  expiresAt: true,
});

export const IZerionWalletPortfolioApi = Symbol('IZerionWalletPortfolioApi');

export interface IZerionWalletPortfolioApi {
  /**
   * Fetches the portfolio data for a wallet from Zerion.
   * Uses the /v1/wallets/{address}/portfolio endpoint.
   *
   * @param args.address - Wallet address
   * @param args.currency - Fiat currency code (e.g., 'USD', 'EUR')
   * @param args.isTestnet - Whether the returned data is for testnets or for mainnets
   * @param args.trusted - If true, only includes trusted (non-trash) tokens (optional)
   * @returns Portfolio data with total and per-chain breakdown
   */
  getPortfolio(args: {
    address: Address;
    currency: string;
    isTestnet: boolean;
    trusted?: boolean;
  }): Promise<ZerionWalletPortfolio>;

  /**
   * Same Zerion call and cache entry as {@link getPortfolio}, returned with
   * the entry's fetch and expiry timestamps.
   *
   * @param args - The wallet, environment, currency and token filter
   * @returns The unvalidated cached snapshot
   */
  getPortfolioSnapshot(
    args: WalletPortfolioIdentity,
  ): Promise<Raw<ZerionWalletPortfolioSnapshot>>;
}

@Injectable()
export class ZerionWalletPortfolioApi implements IZerionWalletPortfolioApi {
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;
  private readonly cacheTtlSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    private readonly zerionRateLimiter: ZerionRateLimiter,
  ) {
    this.apiKey = this.configurationService.get<string>(
      'balances.providers.zerion.apiKey',
    );
    this.baseUri = this.configurationService.getOrThrow<string>(
      'balances.providers.zerion.baseUri',
    );
    this.cacheTtlSeconds = this.configurationService.getOrThrow<number>(
      'balances.providers.zerion.walletPortfolioTtlSeconds',
    );
  }

  async getPortfolio(args: {
    address: Address;
    currency: string;
    isTestnet: boolean;
    trusted?: boolean;
  }): Promise<ZerionWalletPortfolio> {
    const cacheDir = this.getCacheDir(args);
    const cached = await this.getCached(cacheDir);
    if (cached !== null) {
      this.logCacheHit(cacheDir);
      return ZerionWalletPortfolioSchema.parse(cached);
    }
    this.logCacheMiss(cacheDir);
    return await this.fetchAndCache({ ...args, cacheDir });
  }

  async getPortfolioSnapshot(
    args: WalletPortfolioIdentity,
  ): Promise<Raw<ZerionWalletPortfolioSnapshot>> {
    const cacheDir = this.getCacheDir(args);
    const cached = await this.getCached(cacheDir);
    // An entry written before snapshots carried timestamps is refetched once,
    // so the reported freshness is always the entry's real fetch time.
    if (cached !== null && SnapshotTimestampsSchema.safeParse(cached).success) {
      this.logCacheHit(cacheDir);
      return rawify(cached);
    }
    this.logCacheMiss(cacheDir);
    return rawify(await this.fetchAndCache({ ...args, cacheDir }));
  }

  private getCacheDir(
    args: Parameters<IZerionWalletPortfolioApi['getPortfolio']>[0],
  ): CacheDir {
    return CacheRouter.getZerionWalletPortfolioCacheDir({
      address: args.address,
      fiatCode: args.currency,
      trusted: args.trusted,
      isTestnet: args.isTestnet,
    });
  }

  private async getCached(cacheDir: CacheDir): Promise<unknown> {
    const cached = await this.cacheService.hGet(cacheDir);
    return cached == null ? null : JSON.parse(cached);
  }

  private logCacheHit({ key, field }: CacheDir): void {
    this.loggingService.debug({ type: LogType.CacheHit, key, field });
  }

  private logCacheMiss({ key, field }: CacheDir): void {
    this.loggingService.debug({ type: LogType.CacheMiss, key, field });
  }

  private async fetchAndCache(
    args: Parameters<IZerionWalletPortfolioApi['getPortfolio']>[0] & {
      cacheDir: CacheDir;
    },
  ): Promise<ZerionWalletPortfolioSnapshot> {
    // Enforce the shared cross-pod Zerion budget before the network call. Over
    // budget throws LimitReachedError, which callers degrade into a fallback
    // (it is never surfaced as a client-facing 429).
    await this.zerionRateLimiter.assertWithinBudget({
      datasource: 'wallet_portfolio',
      address: args.address,
    });

    const url = `${this.baseUri}/v1/wallets/${args.address}/portfolio`;

    const params: Record<string, string> = {
      currency: args.currency.toLowerCase(),
      'filter[positions]': 'no_filter',
    };

    if (args.trusted) {
      params['filter[trash]'] = 'only_non_trash';
    }

    try {
      const { data } = await this.networkService.get<ZerionWalletPortfolio>({
        url,
        networkRequest: {
          headers: getZerionHeaders(this.apiKey, args.isTestnet),
          params,
        },
      });

      const portfolio = ZerionWalletPortfolioSchema.parse(data);
      const fetchedAt = Date.now();
      const snapshot: ZerionWalletPortfolioSnapshot = {
        ...portfolio,
        fetchedAt,
        expiresAt: fetchedAt + this.cacheTtlSeconds * 1_000,
      };

      await this.cacheService.hSet(
        args.cacheDir,
        JSON.stringify(snapshot),
        this.cacheTtlSeconds,
      );

      return snapshot;
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }
      throw this.httpErrorFactory.from(error);
    }
  }
}
