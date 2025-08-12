import { IConfigurationService } from '@/config/configuration.service.interface';
import { ChainAttributes } from '@/datasources/balances-api/entities/provider-chain-attributes.entity';
import {
  ZerionAttributes,
  ZerionBalance,
  ZerionBalanceSchema,
  ZerionBalances,
  ZerionBalancesSchema,
} from '@/datasources/balances-api/entities/zerion-balance.entity';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { LimitReachedError } from '@/datasources/network/entities/errors/limit-reached.error';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import {
  Erc20Balance,
  NativeBalance,
} from '@/domain/balances/entities/balance.entity';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { getNumberString } from '@/domain/common/utils/utils';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { IPositionsApi } from '@/domain/interfaces/positions-api.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { rawify, type Raw } from '@/validation/entities/raw.entity';
import { Inject, Injectable } from '@nestjs/common';
import { getAddress } from 'viem';
import { z, ZodError } from 'zod';
import { Position } from '@/domain/positions/entities/position.entity';

@Injectable()
export class ZerionPositionsApi implements IPositionsApi {
  private static readonly RATE_LIMIT_CACHE_KEY_PREFIX = 'zerion_positions';
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;
  private readonly chainsConfiguration: Record<number, ChainAttributes>;
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;
  private readonly fiatCodes: Array<string>;
  private readonly limitPeriodSeconds: number;
  private readonly limitCalls: number;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.apiKey = this.configurationService.get<string>(
      'balances.providers.zerion.apiKey',
    );
    this.baseUri = this.configurationService.getOrThrow<string>(
      'balances.providers.zerion.baseUri',
    );
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
    this.chainsConfiguration = this.configurationService.getOrThrow<
      Record<number, ChainAttributes>
    >('balances.providers.zerion.chains');
    this.fiatCodes = this.configurationService
      .getOrThrow<Array<string>>('balances.providers.zerion.currencies')
      .map((currency) => currency.toUpperCase());
    this.limitPeriodSeconds = configurationService.getOrThrow(
      'balances.providers.zerion.limitPeriodSeconds',
    );
    this.limitCalls = configurationService.getOrThrow(
      'balances.providers.zerion.limitCalls',
    );
  }

  async getPositions(args: {
    chain: Chain;
    safeAddress: `0x${string}`;
    fiatCode: string;
  }): Promise<Raw<Array<Position>>> {
    if (!this.fiatCodes.includes(args.fiatCode.toUpperCase())) {
      throw new DataSourceError(
        `Unsupported currency code: ${args.fiatCode}`,
        400,
      );
    }

    const cacheDir = CacheRouter.getZerionPositionsCacheDir({
      chainId: args.chain.chainId,
      safeAddress: args.safeAddress,
      fiatCode: args.fiatCode,
    });
    const chainName = this._getChainName(args.chain);
    const cached = await this.cacheService.hGet(cacheDir);
    if (cached != null) {
      const { key, field } = cacheDir;
      this.loggingService.debug({ type: LogType.CacheHit, key, field });
      const zerionBalances = z
        .array(ZerionBalanceSchema)
        .parse(JSON.parse(cached));
      return this._mapPositions(chainName, zerionBalances);
    }

    try {
      await this._checkRateLimit();
      const { key, field } = cacheDir;
      this.loggingService.debug({ type: LogType.CacheMiss, key, field });
      const url = `${this.baseUri}/v1/wallets/${args.safeAddress}/positions`;
      const networkRequest = {
        headers: { Authorization: `Basic ${this.apiKey}` },
        params: {
          'filter[chain_ids]': chainName,
          'filter[positions]': 'only_complex',
          currency: args.fiatCode.toLowerCase(),
          sort: 'value',
        },
      };
      const zerionBalances = await this.networkService
        .get<ZerionBalances>({
          url,
          networkRequest,
        })
        .then(({ data }) => ZerionBalancesSchema.parse(data));
      await this.cacheService.hSet(
        cacheDir,
        JSON.stringify(zerionBalances.data),
        this.defaultExpirationTimeInSeconds,
      );
      return this._mapPositions(chainName, zerionBalances.data);
    } catch (error) {
      if (error instanceof LimitReachedError || error instanceof ZodError) {
        throw error;
      }
      throw this.httpErrorFactory.from(error);
    }
  }

  async clearPositions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const key = CacheRouter.getZerionPositionsCacheKey(args);
    await this.cacheService.deleteByKey(key);
  }

  async getFiatCodes(): Promise<Raw<Array<string>>> {
    return Promise.resolve(rawify(this.fiatCodes));
  }

  private _mapPositions(
    chainName: string,
    zerionBalances: Array<ZerionBalance>,
  ): Raw<Array<Position>> {
    const balances = zerionBalances
      .filter((zb) => zb.attributes.flags.displayable)
      .map((zb): Position => {
        const implementation = zb.attributes.fungible_info.implementations.find(
          (implementation) => implementation.chain_id === chainName,
        );
        if (!implementation)
          throw Error(
            `Zerion error: ${chainName} implementation not found for balance ${zb.id}`,
          );
        const { value, price, application_metadata } = zb.attributes;
        const fiatBalance = value ? getNumberString(value) : null;
        const fiatConversion = price ? getNumberString(price) : null;

        return {
          ...(implementation.address === null
            ? this._mapNativeBalance(zb.attributes)
            : this._mapErc20Balance(zb.attributes, implementation.address)),
          fiatBalance,
          fiatBalance24hChange: zb.attributes.changes.percent_1d?.toString(),
          fiatConversion,
          protocol: zb.attributes.protocol,
          name: zb.attributes.name,
          position_type: zb.attributes.position_type,
          application_metadata,
        };
      });
    return rawify(balances);
  }

  private _mapErc20Balance(
    zerionBalanceAttributes: ZerionAttributes,
    tokenAddress: string,
  ): Erc20Balance {
    const { fungible_info, quantity } = zerionBalanceAttributes;
    return {
      tokenAddress: getAddress(tokenAddress),
      token: {
        name: fungible_info.name ?? '',
        symbol: fungible_info.symbol ?? '',
        decimals: quantity.decimals,
        logoUri: fungible_info.icon?.url ?? '',
      },
      balance: quantity.int,
    };
  }

  private _mapNativeBalance(
    zerionBalanceAttributes: ZerionAttributes,
  ): NativeBalance {
    return {
      tokenAddress: null,
      token: null,
      balance: zerionBalanceAttributes.quantity.int,
    };
  }

  private _getChainName(chain: Chain): string {
    const chainName =
      chain.balancesProvider.chainName ??
      this.chainsConfiguration[Number(chain.chainId)]?.chainName;

    if (!chainName)
      throw Error(
        `Chain ${chain.chainId} balances retrieval via Zerion is not configured`,
      );

    return chainName;
  }

  private async _checkRateLimit(): Promise<void> {
    const current = await this.cacheService.increment(
      CacheRouter.getRateLimitCacheKey(
        ZerionPositionsApi.RATE_LIMIT_CACHE_KEY_PREFIX,
      ),
      this.limitPeriodSeconds,
    );
    if (current > this.limitCalls) throw new LimitReachedError();
  }
}
