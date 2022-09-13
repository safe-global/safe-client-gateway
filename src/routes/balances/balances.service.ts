import { Inject, Injectable } from '@nestjs/common';
import { Balance as TransactionApiBalance } from '../../domain/balances/entities/balance.entity';
import { TokenInfo } from '../../common/entities/token-info.entity';
import { TokenType } from '../../common/entities/token-type.entity';
import { Balances } from './entities/balances.entity';
import { NativeCurrency } from '../../domain/chains/entities/native.currency.entity';
import { Balance } from './entities/balance.entity';
import { IBalancesRepository } from '../../domain/balances/balances.repository.interface';
import { IExchangeRepository } from '../../domain/exchange/exchange.repository.interface';
import { IChainsRepository } from '../../domain/chains/chains.repository.interface';

@Injectable()
export class BalancesService {
  static readonly fromRateCurrencyCode: string = 'USD';

  constructor(
    @Inject(IBalancesRepository)
    private readonly balancesRepository: IBalancesRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(IExchangeRepository)
    private readonly exchangeRepository: IExchangeRepository,
  ) {}

  async getBalances(
    chainId: string,
    safeAddress: string,
    fiatCode: string,
  ): Promise<Balances> {
    const txServiceBalances = await this.balancesRepository.getBalances(
      chainId,
      safeAddress,
    );

    const usdToFiatRate: number = await this.exchangeRepository.convertRates(
      fiatCode,
      BalancesService.fromRateCurrencyCode,
    );
    const nativeCurrency: NativeCurrency = (
      await this.chainsRepository.getChain(chainId)
    ).nativeCurrency;

    // Map balances payload
    const balances: Balance[] = txServiceBalances.map((balance) =>
      this.mapBalance(balance, usdToFiatRate, nativeCurrency),
    );

    // Get total fiat from [balances]
    const totalFiat: number = balances.reduce((acc, b) => {
      return acc + b.fiatBalance;
    }, 0);

    // Sort balances in place
    balances.sort((b1, b2) => {
      return b2.fiatBalance - b1.fiatBalance;
    });

    return <Balances>{
      fiatTotal: totalFiat,
      items: balances,
    };
  }

  private mapBalance(
    txBalance: TransactionApiBalance,
    usdToFiatRate: number,
    nativeCurrency: NativeCurrency,
  ): Balance {
    const fiatConversion = txBalance.fiatConversion * usdToFiatRate;
    const fiatBalance = txBalance.fiatBalance * usdToFiatRate;
    const tokenType =
      txBalance.tokenAddress === undefined
        ? TokenType.NativeToken
        : TokenType.Erc20;
    const logoUri =
      tokenType === TokenType.NativeToken
        ? nativeCurrency.logoUri
        : txBalance.token?.logoUri;

    return <Balance>{
      tokenInfo: <TokenInfo>{
        tokenType: tokenType,
        address: txBalance.tokenAddress,
        decimals: txBalance.token?.decimals,
        symbol: txBalance.token?.symbol,
        name: txBalance.token?.name,
        logoUri: logoUri,
      },
      balance: txBalance.balance.toString(),
      fiatBalance: fiatBalance,
      fiatConversion: fiatConversion,
    };
  }

  async getSupportedFiatCodes(): Promise<string[]> {
    const fiatCodes: string[] = await this.exchangeRepository.getFiatCodes();
    const mainCurrencies: string[] = ['USD', 'EUR'];
    return [
      ...mainCurrencies,
      ...fiatCodes.filter((item) => !mainCurrencies.includes(item)).sort(),
    ];
  }
}
