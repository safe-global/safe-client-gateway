import { Inject, Injectable } from '@nestjs/common';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import { Balance as TransactionApiBalance } from '@/domain/balances/entities/balance.entity';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { NativeCurrency } from '@/domain/chains/entities/native.currency.entity';
import { Balance } from '@/routes/balances/entities/balance.entity';
import { Balances } from '@/routes/balances/entities/balances.entity';
import { TokenType } from '@/routes/balances/entities/token-type.entity';
import { Token } from '@/routes/balances/entities/token.entity';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { orderBy } from 'lodash';
import { IPricesRepository } from '@/domain/prices/prices.repository.interface';
import { getNumberString } from '@/domain/common/utils/utils';

@Injectable()
export class BalancesService {
  constructor(
    @Inject(IBalancesRepository)
    private readonly balancesRepository: IBalancesRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(IPricesRepository)
    private readonly pricesRepository: IPricesRepository,
  ) {}

  async getBalances(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
    trusted: boolean;
    excludeSpam: boolean;
  }): Promise<Balances> {
    const { chainId } = args;
    const simpleBalances = await this.balancesRepository.getBalances(args);
    const { nativeCurrency } = await this.chainsRepository.getChain(chainId);
    const balances: Balance[] = await Promise.all(
      simpleBalances.map(async (balance) =>
        this._mapBalance(balance, nativeCurrency),
      ),
    );
    const fiatTotal = balances
      .filter((b) => b.fiatBalance !== null)
      .reduce((acc, b) => acc + Number(b.fiatBalance), 0);

    return <Balances>{
      fiatTotal: getNumberString(fiatTotal),
      items: orderBy(balances, (b) => Number(b.fiatBalance), 'desc'),
    };
  }

  private async _mapBalance(
    balance: TransactionApiBalance,
    nativeCurrency: NativeCurrency,
  ): Promise<Balance> {
    const tokenAddress = balance.tokenAddress;
    const tokenType =
      tokenAddress === null ? TokenType.NativeToken : TokenType.Erc20;

    const tokenMetaData =
      tokenType === TokenType.NativeToken
        ? {
            decimals: nativeCurrency.decimals,
            symbol: nativeCurrency.symbol,
            name: nativeCurrency.name,
            logoUri: nativeCurrency.logoUri,
          }
        : {
            decimals: balance.token?.decimals,
            symbol: balance.token?.symbol,
            name: balance.token?.name,
            logoUri: balance.token?.logoUri,
          };

    return <Balance>{
      tokenInfo: <Token>{
        type: tokenType,
        address: tokenAddress ?? NULL_ADDRESS,
        ...tokenMetaData,
      },
      balance: balance.balance,
      fiatBalance: balance.fiatBalance ?? '0',
      fiatConversion: balance.fiatConversion ?? '0',
    };
  }

  /**
   * Gets the list of supported fiat codes.
   * USD and EUR fiat codes are fixed, and should be the first ones in the result list.
   * @returns ordered list of uppercase strings representing the supported fiat codes.
   */
  async getSupportedFiatCodes(): Promise<string[]> {
    const pricesProviderFiatCodes = await this.pricesRepository.getFiatCodes();
    const fiatCodes = pricesProviderFiatCodes
      .map((item) => item.toUpperCase())
      .sort();

    return Array.from(new Set(['USD', 'EUR', ...fiatCodes]));
  }
}
