import { Injectable } from '@nestjs/common';
import { Balance as TransactionServiceBalance } from '../services/transaction-service/entities/balance.entity';
import { ExchangeService } from '../services/exchange/exchange.service';
import { TokenInfo } from '../common/entities/tokeninfo.entity';
import { TokenType } from '../common/entities/tokentype.entity';
import { Balances } from './entities/balances.entity';
import { ConfigService } from '../services/config-service/config-service.service';
import { TransactionServiceManager } from '../services/transaction-service/transaction-service.manager';
import { NativeCurrency } from '../services/config-service/entities/native.currency.entity';
import { Balance } from './entities/balance.entity';

@Injectable()
export class BalancesService {
  static readonly fromRateCurrencyCode: string = 'USD';

  constructor(
    private readonly safeConfigService: ConfigService,
    private readonly safeTransactionManager: TransactionServiceManager,
    private readonly exchangeService: ExchangeService,
  ) {}

  async getBalances(
    chainId: string,
    safeAddress: string,
    fiatCode: string,
  ): Promise<Balances> {
    const safeTransactionService =
      await this.safeTransactionManager.getTransactionService(chainId);
    const txServiceBalances: TransactionServiceBalance[] =
      await safeTransactionService.getBalances(safeAddress);

    const usdToFiatRate: number = await this.exchangeService.convertRates(
      fiatCode,
      BalancesService.fromRateCurrencyCode,
    );
    const nativeCurrency: NativeCurrency = (
      await this.safeConfigService.getChain(chainId)
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
    txBalance: TransactionServiceBalance,
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
    const fiatCodes: string[] = await this.exchangeService.getFiatCodes();
    const mainCurrencies: string[] = ['USD', 'EUR'];
    return [
      ...mainCurrencies,
      ...fiatCodes.filter((item) => !mainCurrencies.includes(item)).sort(),
    ];
  }
}
