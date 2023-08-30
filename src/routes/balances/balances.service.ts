import { Inject, Injectable } from '@nestjs/common';
import { Balance as TransactionApiBalance } from '../../domain/balances/entities/balance.entity';
import { Token } from './entities/token.entity';
import { TokenType } from './entities/token-type.entity';
import { Balances } from './entities/balances.entity';
import { NativeCurrency } from '@/domain/chains/entities/native.currency.entity';
import { Balance } from './entities/balance.entity';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import { IExchangeRepository } from '@/domain/exchange/exchange.repository.interface';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { NULL_ADDRESS } from '../common/constants';

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
    const txServiceBalances = await this.balancesRepository.getBalances(args);

    const usdToFiatRate: number = await this.exchangeRepository.convertRates({
      to: args.fiatCode,
      from: BalancesService.fromRateCurrencyCode,
    });
    const nativeCurrency: NativeCurrency = (
      await this.chainsRepository.getChain(args.chainId)
    ).nativeCurrency;

    // Map balances payload
    const balances: Balance[] = txServiceBalances.map((balance) =>
      this.mapBalance(balance, usdToFiatRate, nativeCurrency),
    );

    // Get total fiat from [balances]
    const totalFiat: number = balances.reduce((acc, b) => {
      return acc + Number(b.fiatBalance);
    }, 0);

    // Sort balances in place
    balances.sort((b1, b2) => {
      return Number(b2.fiatBalance) - Number(b1.fiatBalance);
    });

    return <Balances>{
      fiatTotal: this.getNumberString(totalFiat),
      items: balances,
    };
  }

  private mapBalance(
    txBalance: TransactionApiBalance,
    usdToFiatRate: number,
    nativeCurrency: NativeCurrency,
  ): Balance {
    const fiatConversion = Number(txBalance.fiatConversion) * usdToFiatRate;
    const fiatBalance = Number(txBalance.fiatBalance) * usdToFiatRate;
    const tokenAddress = txBalance.tokenAddress ?? NULL_ADDRESS;
    const tokenType =
      tokenAddress === NULL_ADDRESS ? TokenType.NativeToken : TokenType.Erc20;

    const tokenMetaData =
      tokenType === TokenType.NativeToken
        ? {
            decimals: nativeCurrency.decimals,
            symbol: nativeCurrency.symbol,
            name: nativeCurrency.name,
            logoUri: nativeCurrency.logoUri,
          }
        : {
            decimals: txBalance.token?.decimals,
            symbol: txBalance.token?.symbol,
            name: txBalance.token?.name,
            logoUri: txBalance.token?.logoUri,
          };

    return <Balance>{
      tokenInfo: <Token>{
        type: tokenType,
        address: tokenAddress,
        ...tokenMetaData,
      },
      balance: txBalance.balance,
      fiatBalance: this.getNumberString(fiatBalance),
      fiatConversion: this.getNumberString(fiatConversion),
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
