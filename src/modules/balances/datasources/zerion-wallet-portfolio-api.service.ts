// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { ZodError } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import {
  type ZerionWalletPortfolio,
  ZerionWalletPortfolioSchema,
} from '@/modules/balances/datasources/entities/zerion-wallet-portfolio.entity';
import { getZerionHeaders } from '@/modules/balances/datasources/zerion-api.helpers';
import { ZerionRateLimiter } from '@/modules/zerion/datasources/zerion-rate-limiter.service';

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
   * Clears all cached variants for the address and flags it so the next
   * fetch asks Zerion to re-aggregate (sync=true) — clearing alone would
   * re-cache Zerion's pre-event snapshot.
   */
  invalidatePortfolio(args: { address: Address }): Promise<void>;
}

@Injectable()
export class ZerionWalletPortfolioApi implements IZerionWalletPortfolioApi {
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;
  private readonly cacheTtlSeconds: number;
  private readonly syncFlagMinSeconds: number;

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
    this.syncFlagMinSeconds = this.configurationService.getOrThrow<number>(
      'balances.providers.zerion.syncFlagMinSeconds',
    );
  }

  async getPortfolio(args: {
    address: Address;
    currency: string;
    isTestnet: boolean;
    trusted?: boolean;
  }): Promise<ZerionWalletPortfolio> {
    const cacheDir = CacheRouter.getZerionWalletPortfolioCacheDir({
      address: args.address,
      fiatCode: args.currency,
      trusted: args.trusted,
      isTestnet: args.isTestnet,
    });

    const { key, field } = cacheDir;

    const syncFlagDir = CacheRouter.getZerionSyncFlagCacheDir({
      address: args.address,
    });
    const needsSync = (await this.cacheService.hGet(syncFlagDir)) != null;

    if (!needsSync) {
      const cached = await this.cacheService.hGet(cacheDir);
      if (cached != null) {
        this.loggingService.debug({ type: LogType.CacheHit, key, field });
        return ZerionWalletPortfolioSchema.parse(JSON.parse(cached));
      }
    }

    this.loggingService.debug({ type: LogType.CacheMiss, key, field });

    // Enforce the shared cross-pod Zerion budget before the network call. Over
    // budget throws LimitReachedError, which the overview service degrades into
    // a fallback (it is never surfaced as a client-facing 429).
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

    if (needsSync) {
      // Zerion re-aggregates from chain state before responding.
      params.sync = 'true';
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

      await this.cacheService.hSet(
        cacheDir,
        JSON.stringify(portfolio),
        this.cacheTtlSeconds,
      );

      if (needsSync) {
        // Only a successful sync fetch consumes the flag.
        await this.cacheService.deleteByKey(syncFlagDir.key);
      }

      return portfolio;
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }
      throw this.httpErrorFactory.from(error);
    }
  }

  async invalidatePortfolio(args: { address: Address }): Promise<void> {
    const syncFlagDir = CacheRouter.getZerionSyncFlagCacheDir({
      address: args.address,
    });
    await Promise.all([
      this.cacheService.deleteByKey(
        CacheRouter.getZerionWalletPortfolioCacheKey({
          address: args.address,
        }),
      ),
      this.cacheService.hSet(
        syncFlagDir,
        'true',
        Math.max(this.cacheTtlSeconds, this.syncFlagMinSeconds),
      ),
    ]);
  }
}
