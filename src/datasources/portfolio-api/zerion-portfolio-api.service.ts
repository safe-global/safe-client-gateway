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
          ...(args.chainIds && {
            'filter[chain_ids]': args.chainIds.join(','),
          }),
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
        const impl = position.attributes.fungible_info.implementations[0];
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
            chainId: impl.chain_id,
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
        const impl = position.attributes.fungible_info.implementations[0];
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
            chainId: impl.chain_id,
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
}
