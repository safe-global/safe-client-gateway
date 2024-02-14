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

  private static readonly collectiblesSorting = '-floor_price';
  private static readonly defaultPageSize = 10;

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

  /**
   * NOTE: Zerion does not support limit & offset parameters.
   *
   * It uses a "size" query param for the page size, and an "after" parameter for the offset.
   * "size" is an integer which could be mapped to "limit", but "after" is a custom identifier.
   *
   * Since this setup does not align well with the CGW API, it is needed to encode/decode these parameters.
   */
  async getCollectibles(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Collectible>> {
    try {
      const cacheDir = CacheRouter.getZerionCollectiblesCacheDir(args);
      const chainName = this._getChainName(args.chainId);
      const url = `${this.baseUri}/v1/wallets/${args.safeAddress}/nft-positions`;
      const pageAfter = this._encodeZerionPageOffset(args.offset);
      const params = {
        'filter[chain_ids]': chainName,
        sort: ZerionBalancesApi.collectiblesSorting,
        'page[size]': args.limit,
        ...(pageAfter && { 'page[after]': pageAfter }),
      };
      const zerionCollectibles = await this.dataSource.get<ZerionCollectibles>({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: {
          headers: { Authorization: `Basic ${this.apiKey}` },
          params,
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

  async clearCollectibles(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const key = CacheRouter.getZerionCollectiblesCacheKey(args);
    await this.cacheService.deleteByKey(key);
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
    return {
      count: zerionCollectibles.data.length,
      next: this._decodeZerionPagination(zerionCollectibles.links.next ?? ''),
      previous: null,
      results: zerionCollectibles.data.map(
        ({ attributes: { nft_info, collection_info } }) => ({
          address: nft_info.contract_address,
          tokenName: nft_info.name ?? '',
          tokenSymbol: nft_info.name ?? '',
          logoUri: collection_info?.content?.icon.url ?? '',
          id: nft_info.token_id,
          uri: nft_info.content?.detail?.url ?? null,
          name: collection_info?.name ?? null,
          description: collection_info?.description ?? null,
          imageUri: nft_info.content?.preview?.url ?? '',
          metadata: nft_info.content,
        }),
      ),
    };
  }

  /**
   * Zerion represents cursor offsets by base64 string
   * contained within double quotation marks.
   *
   * @param offset number representing the offset
   * @returns base64 string representing the offset
   */
  private _encodeZerionPageOffset(offset?: number): string | null {
    return offset
      ? Buffer.from(`"${offset}"`, 'utf8').toString('base64')
      : null;
  }

  /**
   * Zerion uses page[size] as pagination limit.
   * Zerion uses page[after] as pagination offset, which is a
   * base64 string contained within double quotation marks.
   *
   * @param url Zerion-formatted string representing an URL
   * @returns URL string optionally containing "limit" and "offset" query params
   */
  private _decodeZerionPagination(url: string): string {
    const zerionUrl = new URL(url);
    const size = zerionUrl.searchParams.get('page[size]');
    const after = zerionUrl.searchParams.get('page[after]');

    const resultUrl = new URL(zerionUrl);
    if (size) resultUrl.searchParams.set('limit', size);
    if (after) {
      resultUrl.searchParams.set(
        'offset',
        Buffer.from(after ?? '0', 'base64')
          .toString('utf8')
          .replace(/"/g, ''),
      );
    }
    return resultUrl.toString();
  }
}
