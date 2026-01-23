import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  ZerionAttributes,
  ZerionBalance,
  ZerionBalanceSchema,
  ZerionBalances,
  ZerionBalancesSchema,
} from '@/modules/balances/datasources/entities/zerion-balance.entity';
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
} from '@/modules/balances/domain/entities/balance.entity';
import { Chain } from '@/modules/chains/domain/entities/chain.entity';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { getNumberString } from '@/domain/common/utils/utils';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { IPositionsApi } from '@/domain/interfaces/positions-api.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { rawify, type Raw } from '@/validation/entities/raw.entity';
import { Inject, Injectable } from '@nestjs/common';
import { Address, getAddress } from 'viem';
import { z, ZodError } from 'zod';
import { Position } from '@/modules/positions/domain/entities/position.entity';
import {
  getZerionHeaders,
  normalizeZerionBalances,
} from '@/modules/balances/datasources/zerion-api.helpers';
import { ZerionChainMappingService } from '@/modules/zerion/datasources/zerion-chain-mapping.service';

@Injectable()
export class ZerionPositionsApi implements IPositionsApi {
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly fiatCodes: Array<string>;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
    private readonly zerionChainMappingService: ZerionChainMappingService,
  ) {
    this.apiKey = this.configurationService.get<string>(
      'balances.providers.zerion.apiKey',
    );
    this.baseUri = this.configurationService.getOrThrow<string>(
      'balances.providers.zerion.baseUri',
    );
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.zerionPositions',
      );
    this.fiatCodes = this.configurationService.getOrThrow<Array<string>>(
      'balances.providers.zerion.currencies',
    );
  }

  async getPositions(args: {
    chain: Chain;
    safeAddress: Address;
    fiatCode: string;
    refresh?: string;
    sync?: boolean;
  }): Promise<Raw<Array<Position>>> {
    if (!this.fiatCodes.includes(args.fiatCode.toUpperCase())) {
      throw new DataSourceError(
        `Unsupported currency code: ${args.fiatCode}`,
        400,
      );
    }

    const cacheDir = CacheRouter.getZerionPositionsCacheDir({
      safeAddress: args.safeAddress,
      fiatCode: args.fiatCode,
      refresh: args.refresh,
    });
    const chainName = await this._getChainName(args.chain);

    const cached = await this.cacheService.hGet(cacheDir);
    if (cached != null) {
      const { key, field } = cacheDir;
      this.loggingService.debug({ type: LogType.CacheHit, key, field });
      const balances = z.array(ZerionBalanceSchema).parse(JSON.parse(cached));
      return this._mapPositions(chainName, balances);
    }

    try {
      const { key, field } = cacheDir;
      this.loggingService.debug({
        type: LogType.CacheMiss,
        key,
        field,
      });
      const url = `${this.baseUri}/v1/wallets/${args.safeAddress}/positions`;
      const params: Record<string, string> = {
        'filter[chain_ids]': chainName,
        'filter[positions]': 'only_complex',
        currency: args.fiatCode.toLowerCase(),
        sort: 'value',
      };
      if (args.sync) {
        params['sync'] = 'true';
      }
      const networkRequest = {
        headers: getZerionHeaders(this.apiKey, args.chain.isTestnet),
        params,
      };
      const zerionBalances = await this.networkService
        .get<ZerionBalances>({
          url,
          networkRequest,
        })
        .then(({ data }) => ZerionBalancesSchema.parse(data));
      const balances = normalizeZerionBalances(zerionBalances.data);
      await this.cacheService.hSet(
        cacheDir,
        JSON.stringify(balances),
        this.defaultExpirationTimeInSeconds,
      );
      return this._mapPositions(chainName, balances);
    } catch (error) {
      if (error instanceof LimitReachedError || error instanceof ZodError) {
        throw error;
      }
      throw this.httpErrorFactory.from(error);
    }
  }

  async clearPositions(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const key = CacheRouter.getZerionPositionsCacheKey({
      safeAddress: args.safeAddress,
    });
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
        const fiatBalance = value !== null ? getNumberString(value) : null;
        const fiatConversion = price !== null ? getNumberString(price) : null;

        return {
          ...(implementation.address === null
            ? this._mapNativeBalance(zb.attributes)
            : this._mapErc20Balance(zb.attributes, implementation.address)),
          fiatBalance,
          fiatBalance24hChange:
            zb.attributes.changes?.percent_1d?.toString() ?? null,
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

  /**
   * Map chainIds to chain names that are accepted on the Zerion API.
   * It doesn't accept conventional chain ids but expects some internal id.
   * @param chain
   * @private
   */
  private async _getChainName(chain: Chain): Promise<string> {
    const chainName =
      chain.balancesProvider.chainName ||
      (await this.zerionChainMappingService.getNetworkFromChainId(
        chain.chainId,
        chain.isTestnet,
      ));

    if (!chainName) {
      throw Error(
        `Chain ${chain.chainId} balances retrieval via Zerion is not configured`,
      );
    }

    return chainName;
  }
}
