import { Inject, Injectable } from '@nestjs/common';
import { Token } from './entities/token.entity';
import { TokenType } from './entities/token-type.entity';
import { Balances } from './entities/balances.entity';
import { Balance } from './entities/balance.entity';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { NULL_ADDRESS } from '../common/constants';
import { orderBy } from 'lodash';
import { IConfigurationService } from '../../config/configuration.service.interface';
import { IPortfoliosRepository } from '../../domain/portfolios/portfolios.repository.interface';
import {
  Position,
  PositionFungibleInfo,
} from '../../domain/portfolios/entities/position.entity';

@Injectable()
export class BalancesService {
  static readonly fromRateCurrencyCode: string = 'USD';
  private knownImplementations: Record<string, string>[];

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(IPortfoliosRepository)
    private readonly portfoliosRepository: IPortfoliosRepository,
  ) {
    this.knownImplementations = configurationService.getOrThrow(
      'chains.knownImplementations',
    );
  }

  getNumberString(value: number): string {
    // Prevent scientific notation
    return value.toLocaleString('fullwide', {
      useGrouping: false,
    });
  }

  async getBalances(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balances> {
    const { chainId, safeAddress, fiatCode: currency } = args;
    const chainName = this._getChainName(chainId);
    const positions = await this.portfoliosRepository.getPositions({
      chainName,
      safeAddress,
      currency,
    });
    const portfolio = await this.portfoliosRepository.getPortfolio({
      safeAddress,
      currency,
    });
    const balances = positions.map((p) => this.mapBalance(chainName, p));

    return <Balances>{
      fiatTotal: this.getNumberString(portfolio.attributes.total.positions),
      items: orderBy(balances, (b) => Number(b.fiatBalance), 'desc'),
    };
  }

  private mapBalance(chainName: string, position: Position): Balance {
    const { attributes } = position;
    const { fungible_info: fungibleInfo, quantity } = attributes;
    const tokenAddress = this._getImplementationAddress(
      chainName,
      fungibleInfo,
    );

    const tokenType =
      tokenAddress === null ? TokenType.NativeToken : TokenType.Erc20;

    const tokenMetaData = {
      decimals: quantity.decimals,
      symbol: fungibleInfo.symbol,
      name: fungibleInfo.name,
      logoUri: fungibleInfo.icon?.url,
    };

    return <Balance>{
      tokenInfo: <Token>{
        type: tokenType,
        address: tokenAddress ?? NULL_ADDRESS,
        ...tokenMetaData,
      },
      balance: quantity.int,
      fiatBalance: this.getNumberString(attributes.value ?? 0), // TODO: review fallback
      fiatConversion: this.getNumberString(attributes.price),
    };
  }

  async getSupportedFiatCodes(): Promise<string[]> {
    throw new Error('Unimplemented');
  }

  private _getImplementationAddress(
    chainName: string,
    fungibleInfo: PositionFungibleInfo,
  ): string | null {
    const implementation = fungibleInfo?.implementations.find(
      ({ chain_id }) => chain_id === chainName,
    );
    return implementation?.address ?? null;
  }

  private _getChainName(chainId: string): string {
    const chainName = this.knownImplementations.find(
      (i) => i.chainId === chainId,
    )?.implementationName;

    if (!chainName)
      throw Error(`Chain ${chainId} is not configured: no implementationName`);

    return chainName;
  }
}
