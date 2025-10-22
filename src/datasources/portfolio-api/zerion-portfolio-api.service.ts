import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { getAddress, isAddress } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { IPortfolioApi } from '@/domain/interfaces/portfolio-api.interface';
import type { Portfolio } from '@/domain/portfolio/entities/portfolio.entity';
import type { TokenBalance } from '@/domain/portfolio/entities/token-balance.entity';
import type { AppBalance } from '@/domain/portfolio/entities/app-balance.entity';
import type { AppPosition } from '@/domain/portfolio/entities/app-position.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { rawify, type Raw } from '@/validation/entities/raw.entity';
import type { ZerionBalance } from '@/datasources/balances-api/entities/zerion-balance.entity';
import { ZerionBalancesSchema } from '@/datasources/balances-api/entities/zerion-balance.entity';
import { ZodError } from 'zod';

@Injectable()
export class ZerionPortfolioApi implements IPortfolioApi {
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;
  private readonly fiatCodes: Array<string>;

  constructor(
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
    this.fiatCodes = this.configurationService
      .getOrThrow<Array<string>>('balances.providers.zerion.currencies')
      .map((currency) => currency.toUpperCase());
  }

  async getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
  }): Promise<Raw<Portfolio>> {
    if (!this.fiatCodes.includes(args.fiatCode.toUpperCase())) {
      throw new DataSourceError(
        `Unsupported currency code: ${args.fiatCode}`,
        400,
      );
    }

    try {
      const url = `${this.baseUri}/v1/wallets/${args.address}/positions`;
      const networkRequest = {
        headers: { Authorization: `Basic ${this.apiKey}` },
        params: {
          currency: args.fiatCode.toLowerCase(),
          sort: 'value',
          'filter[positions]': 'no_filter',
        },
      };

      const response = await this.networkService
        .get({
          url,
          networkRequest,
        })
        .then(({ data }) => ZerionBalancesSchema.parse(data));

      return this._buildPortfolio(response.data);
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }
      throw this.httpErrorFactory.from(error);
    }
  }

  private _buildPortfolio(
    positions: Array<ZerionBalance>,
  ): Raw<Portfolio> {
    const displayablePositions = positions.filter(
      (p) => p.attributes.flags.displayable && !p.attributes.flags.is_trash,
    );

    const walletPositions = displayablePositions.filter(
      (p) => p.attributes.position_type === 'wallet',
    );
    const appPositions = displayablePositions.filter(
      (p) => p.attributes.position_type !== 'wallet',
    );

    const tokenBalances = this._buildTokenBalances(walletPositions);
    const appBalances = this._buildAppBalances(appPositions);

    const totalBalanceFiat = this._calculateTotalBalance(displayablePositions);
    const totalTokenBalanceFiat = this._calculateTotalBalance(walletPositions);
    const totalPositionsBalanceFiat = this._calculateTotalBalance(appPositions);

    return rawify({
      totalBalanceFiat,
      totalTokenBalanceFiat,
      totalPositionsBalanceFiat,
      tokenBalances,
      positionBalances: appBalances,
    });
  }

  private _buildTokenBalances(
    positions: Array<ZerionBalance>,
  ): Array<TokenBalance> {
    return positions
      .map((position): TokenBalance | null => {
        const networkName = position.relationships?.chain?.data?.id;
        if (!networkName) return null;

        const chainId = this._mapNetworkToChainId(networkName);

        // Find the implementation for this specific chain
        const impl = position.attributes.fungible_info.implementations.find(
          (i) => i.chain_id === networkName,
        );
        if (!impl) return null;

        // Skip if address is invalid (but null is allowed for native tokens)
        if (impl.address !== null && !isAddress(impl.address)) {
          return null;
        }

        const address = impl.address ? getAddress(impl.address) : null;

        return {
          tokenInfo: {
            address,
            decimals: impl.decimals,
            symbol:
              position.attributes.fungible_info.symbol ??
              position.attributes.name,
            name:
              position.attributes.fungible_info.name ??
              position.attributes.name,
            logoUrl: position.attributes.fungible_info.icon?.url ?? null,
            chainId,
          },
          balance: position.attributes.quantity.numeric,
          balanceFiat: position.attributes.value ?? null,
          price: position.attributes.price ?? null,
          priceChangePercentage1d:
            position.attributes.changes?.percent_1d ?? null,
        };
      })
      .filter((token): token is TokenBalance => token !== null);
  }

  private _buildAppBalances(
    positions: Array<ZerionBalance>,
  ): Array<AppBalance> {
    const grouped = new Map<string, Array<ZerionBalance>>();

    for (const position of positions) {
      const appName =
        position.attributes.application_metadata?.name ??
        position.attributes.protocol ??
        'Unknown';
      if (!grouped.has(appName)) {
        grouped.set(appName, []);
      }
      grouped.get(appName)!.push(position);
    }

    return Array.from(grouped.entries()).map(
      ([appName, appPositions]): AppBalance => {
        const firstPosition = appPositions[0];
        const appMetadata = firstPosition.attributes.application_metadata;

        const positions = this._buildAppPositions(appPositions);
        const balanceFiat = this._calculatePositionsBalance(appPositions);

        return {
          appInfo: {
            name: appName,
            logoUrl: appMetadata?.icon?.url ?? null,
            url: appMetadata?.url ?? null,
          },
          balanceFiat,
          positions,
        };
      },
    );
  }

  private _buildAppPositions(
    positions: Array<ZerionBalance>,
  ): Array<AppPosition> {
    return positions
      .map((position): AppPosition | null => {
        const networkName = position.relationships?.chain?.data?.id;
        if (!networkName) return null;

        const chainId = this._mapNetworkToChainId(networkName);

        // Find the implementation for this specific chain
        const impl = position.attributes.fungible_info.implementations.find(
          (i) => i.chain_id === networkName,
        );
        if (!impl) return null;

        // Skip if address is invalid (but null is allowed for native tokens)
        if (impl.address !== null && !isAddress(impl.address)) {
          return null;
        }

        const address = impl.address ? getAddress(impl.address) : null;

        return {
          key: position.id,
          type: position.attributes.position_type,
          name: position.attributes.name,
          tokenInfo: {
            address,
            decimals: impl.decimals,
            symbol:
              position.attributes.fungible_info.symbol ??
              position.attributes.name,
            name:
              position.attributes.fungible_info.name ??
              position.attributes.name,
            logoUrl: position.attributes.fungible_info.icon?.url ?? null,
            chainId,
          },
          balance: position.attributes.quantity.numeric,
          balanceFiat: position.attributes.value ?? null,
          priceChangePercentage1d:
            position.attributes.changes?.percent_1d ?? null,
        };
      })
      .filter((pos): pos is AppPosition => pos !== null);
  }

  private _calculateTotalBalance(positions: Array<ZerionBalance>): number {
    return positions.reduce((sum, position) => {
      return sum + (position.attributes.value ?? 0);
    }, 0);
  }

  private _calculatePositionsBalance(positions: Array<ZerionBalance>): number {
    return positions.reduce((sum, position) => {
      return sum + (position.attributes.value ?? 0);
    }, 0);
  }

  private _mapNetworkToChainId(network: string): string {
    const mapping: Record<string, string> = {
      '0g': '16661',
      abstract: '2741',
      ape: '33139',
      arbitrum: '42161',
      aurora: '1313161554',
      avalanche: '43114',
      base: '8453',
      berachain: '80094',
      'binance-smart-chain': '56',
      bsc: '56',
      blast: '81457',
      bob: '60808',
      celo: '42220',
      'cronos-zkevm': '388',
      cyber: '7560',
      degen: '666666666',
      ethereum: '1',
      fantom: '250',
      fraxtal: '252',
      gnosis: '100',
      'gravity-alpha': '1625',
      hyperevm: '999',
      ink: '57073',
      katana: '747474',
      lens: '232',
      linea: '59144',
      lisk: '1135',
      'manta-pacific': '169',
      mantle: '5000',
      'metis-andromeda': '1088',
      mode: '34443',
      okbchain: '196',
      opbnb: '204',
      optimism: '10',
      plasma: '9745',
      polygon: '137',
      'polygon-zkevm': '1101',
      polynomial: '8008',
      rari: '1380012617',
      're-al': '111188',
      redstone: '690',
      ronin: '2020',
      scroll: '534352',
      sei: '1329',
      solana: '101',
      somnia: '5031',
      soneium: '1868',
      sonic: '146',
      swellchain: '1923',
      taiko: '167000',
      tomochain: '88',
      unichain: '130',
      wonder: '9637',
      world: '480',
      xdai: '100',
      'xinfin-xdc': '50',
      zero: '543210',
      zkcandy: '320',
      'zklink-nova': '810180',
      zksync: '324',
      'zksync-era': '324',
      zora: '7777777',
    };
    return mapping[network.toLowerCase()] ?? '1';
  }
}
