import { IConfigurationService } from '@/config/configuration.service.interface';
import { ChainAttributes } from '@/datasources/balances-api/entities/provider-chain-attributes.entity';
import {
  ZerionAttributes,
  ZerionBalance,
  ZerionBalances,
} from '@/datasources/balances-api/entities/zerion-balance.entity';
import { ZerionCollectibles } from '@/datasources/balances-api/entities/zerion-collectible.entity';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import {
  Balance,
  Erc20Balance,
  NativeBalance,
} from '@/domain/balances/entities/balance.entity';
import { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import { getNumberString } from '@/domain/common/utils/utils';
import { Page } from '@/domain/entities/page.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import { asError } from '@/logging/utils';
import { Inject, Injectable } from '@nestjs/common';

export const IZerionBalancesApi = Symbol('IZerionBalancesApi');

@Injectable()
export class ZerionBalancesApi implements IBalancesApi {
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;
  private readonly chainsConfiguration: Record<number, ChainAttributes>;
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;
  private readonly fiatCodes: string[];

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly dataSource: CacheFirstDataSource,
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
      .getOrThrow<string[]>('balances.providers.zerion.currencies')
      .map((currency) => currency.toUpperCase());
  }

  async getBalances(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
  }): Promise<Balance[]> {
    try {
      const cacheDir = CacheRouter.getZerionBalancesCacheDir(args);
      const chainName = this._getChainName(args.chainId);
      const currency = args.fiatCode.toLowerCase();
      const url = `${this.baseUri}/v1/wallets/${args.safeAddress}/positions`;
      const { data } = await this.dataSource.get<ZerionBalances>({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: {
          headers: { Authorization: `Basic ${this.apiKey}` },
          params: {
            'filter[chain_ids]': chainName,
            currency: currency,
            sort: 'value',
          },
        },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
      return this._mapBalances(chainName, data);
    } catch (error) {
      throw new DataSourceError(
        `Error getting ${args.safeAddress} balances from provider: ${asError(error).message}}`,
      );
    }
  }

  async getCollectibles(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<Page<Collectible>> {
    // TODO: add pagination
    try {
      const cacheDir = CacheRouter.getZerionCollectiblesCacheDir(args);
      const chainName = this._getChainName(args.chainId);
      const url = `${this.baseUri}/v1/wallets/${args.safeAddress}/nft-positions`;
      const zerionCollectibles = await this.dataSource.get<ZerionCollectibles>({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: {
          headers: { Authorization: `${this.apiKey}` },
          params: {
            'filter[chain_ids]': chainName,
            sort: '-floor_price', // TODO: extract to var/configuration
          },
        },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
      return this._mapCollectibles(zerionCollectibles);
    } catch (error) {
      throw new DataSourceError(
        `Error getting ${args.safeAddress} collectibles from provider: ${asError(error).message}}`,
      );
    }
  }

  async clearCollectibles(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private _mapBalances(
    chainName: string,
    zerionBalances: ZerionBalance[],
  ): Balance[] {
    return zerionBalances
      .filter((zb) => zb.attributes.flags.displayable)
      .map((zb) => {
        const implementation = zb.attributes.fungible_info.implementations.find(
          (implementation) => implementation.chain_id === chainName,
        );
        if (!implementation)
          throw Error(
            `Zerion error: ${chainName} implementation not found for balance ${zb.id}`,
          );
        const { value } = zb.attributes;
        const fiatBalance = value ? getNumberString(value) : null;
        const fiatConversion = getNumberString(zb.attributes.price);

        return {
          ...(implementation.address === null
            ? this._mapNativeBalance(zb.attributes)
            : this._mapErc20Balance(zb.attributes, implementation.address)),
          fiatBalance,
          fiatConversion,
        };
      });
  }

  getFiatCodes(): string[] {
    return this.fiatCodes;
  }

  private _mapErc20Balance(
    zerionBalanceAttributes: ZerionAttributes,
    tokenAddress: string,
  ): Erc20Balance {
    const { fungible_info, quantity } = zerionBalanceAttributes;
    return {
      tokenAddress,
      token: {
        name: fungible_info.name ?? '',
        symbol: fungible_info.symbol ?? '',
        decimals: quantity.decimals,
        logoUri: fungible_info.icon.url ?? '',
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

  async clearBalances(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const key = CacheRouter.getZerionBalancesCacheKey(args);
    await this.cacheService.deleteByKey(key);
  }

  private _getChainName(chainId: string): string {
    const chainName = this.chainsConfiguration[Number(chainId)]?.chainName;
    if (!chainName)
      throw Error(
        `Chain ${chainId} balances retrieval via Zerion is not configured`,
      );
    return chainName;
  }

  private _mapCollectibles(
    zerionCollectibles: ZerionCollectibles,
  ): Page<Collectible> {
    // const collectibles: Collectible[] = zerionCollectibles.data.map((zc) => ({
    //   address: zc.attributes.nft_info.contract_address,
    //   tokenName: zc.attributes.nft_info.name,
    //   tokenSymbol: zc.attributes.nft_info.name,
    //   logoUri: zc.attributes.collection_info?.content?.icon,
    //   id: zc.attributes.nft_info.token_id,
    //   uri: zc.attributes.nft_info.content.preview?.url,
    //   name: zc.attributes.collection_info?.name,
    //   description: zc.attributes.collection_info?.description,
    //   metadata: zc.attributes.nft_info.content,
    // }));

    return {
      count: zerionCollectibles.data.length, // TODO: count and pagination
      next: null,
      previous: null,
      results: [],
    };
  }
}
