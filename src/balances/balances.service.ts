import { Injectable } from '@nestjs/common';
import { Balance as TransactionApiBalance } from '../datasources/transaction-api/entities/balance.entity';
import { ExchangeApi } from '../datasources/exchange-api/exchange-api.service';
import { TokenInfo } from '../common/entities/token-info.entity';
import { TokenType } from '../common/entities/token-type.entity';
import { Balances } from './entities/balances.entity';
import { ConfigApi } from '../datasources/config-api/config-api.service';
import { TransactionApiManager } from '../datasources/transaction-api/transaction-api.manager';
import { NativeCurrency } from '../datasources/config-api/entities/native.currency.entity';
import { Balance } from './entities/balance.entity';

@Injectable()
export class BalancesService {
  static readonly fromRateCurrencyCode: string = 'USD';

  constructor(
    private readonly configApi: ConfigApi,
    private readonly transactionApiManager: TransactionApiManager,
    private readonly exchangeApi: ExchangeApi,
  ) {}

  async getBalances(
    chainId: string,
    safeAddress: string,
    fiatCode: string,
  ): Promise<Balances> {
    const transactionApi = await this.transactionApiManager.getTransactionApi(
      chainId,
    );
    const txServiceBalances: TransactionApiBalance[] =
      await transactionApi.getBalances(safeAddress);

    const usdToFiatRate: number = await this.exchangeApi.convertRates(
      fiatCode,
      BalancesService.fromRateCurrencyCode,
    );
    const nativeCurrency: NativeCurrency = (
      await this.configApi.getChain(chainId)
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
        : txBalance.token?.logo_uri;

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
    const fiatCodes: string[] = await this.exchangeApi.getFiatCodes();
    const mainCurrencies: string[] = ['USD', 'EUR'];
    return [
      ...mainCurrencies,
      ...fiatCodes.filter((item) => !mainCurrencies.includes(item)).sort(),
    ];
  }
}
