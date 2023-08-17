import { Inject, Injectable } from '@nestjs/common';
import { Balance as TransactionApiBalance } from '../../domain/balances/entities/balance.entity';
import { Token } from './entities/token.entity';
import { TokenType } from './entities/token-type.entity';
import { Balances } from './entities/balances.entity';
import { NativeCurrency } from '../../domain/chains/entities/native.currency.entity';
import { Balance } from './entities/balance.entity';
import { IBalancesRepository } from '../../domain/balances/balances.repository.interface';
import { IExchangeRepository } from '../../domain/exchange/exchange.repository.interface';
import { IChainsRepository } from '../../domain/chains/chains.repository.interface';
import { NULL_ADDRESS } from '../common/constants';
import { IPricesRepository } from '../../domain/prices/prices.repository.interface';
import { sortBy, sumBy } from 'lodash';
import { IConfigurationService } from '../../config/configuration.service.interface';

@Injectable()
export class BalancesService {
  static readonly fromRateCurrencyCode: string = 'USD';

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IBalancesRepository)
    private readonly balancesRepository: IBalancesRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(IExchangeRepository)
    private readonly exchangeRepository: IExchangeRepository,
    @Inject(IPricesRepository)
    private readonly pricesRepository: IPricesRepository,
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
    const { chainId, fiatCode } = args;
    const txServiceBalances = await this.balancesRepository.getBalances(args);
    // TODO: this could be moved to Safe Config Service
    const nativeCoinId = this.configurationService.getOrThrow<string>(
      `chains.nativeCoins.${chainId}`,
    );

    const { nativeCurrency } = await this.chainsRepository.getChain(chainId);
    const balances: Balance[] = await Promise.all(
      txServiceBalances.map(async (balance) =>
        this.mapBalance(balance, nativeCoinId, fiatCode, nativeCurrency),
      ),
    );
    const totalFiat = sumBy(balances, 'fiatBalance');

    return <Balances>{
      fiatTotal: this.getNumberString(totalFiat),
      items: sortBy(balances, 'fiatCode'),
    };
  }

  private async mapBalance(
    txBalance: TransactionApiBalance,
    nativeCoinId: string,
    fiatCode: string,
    nativeCurrency: NativeCurrency,
  ): Promise<Balance> {
    const tokenAddress = txBalance.tokenAddress;
    let fiatConversion, fiatBalance;
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
            decimals: txBalance.token?.decimals,
            symbol: txBalance.token?.symbol,
            name: txBalance.token?.name,
            logoUri: txBalance.token?.logoUri,
          };

    if (tokenAddress === null) {
      // Native coin
      fiatConversion = await this.pricesRepository.getNativeCoinPrice({
        nativeCoinId,
        fiatCode,
      });
      fiatBalance =
        (fiatConversion * Number(txBalance.balance)) /
        10 ** (txBalance.token?.decimals ?? 18); // TODO: review decimals
    } else {
      // ERC20 token
      fiatConversion = await this.pricesRepository.getTokenPrice({
        nativeCoinId,
        tokenAddress,
        fiatCode,
      });
      fiatBalance =
        (fiatConversion * Number(txBalance.balance)) /
        10 ** (txBalance.token?.decimals ?? 18);
    }

    return <Balance>{
      tokenInfo: <Token>{
        type: tokenType,
        address: tokenAddress ?? NULL_ADDRESS,
        ...tokenMetaData,
      },
      balance: txBalance.balance,
      fiatBalance: fiatBalance ? this.getNumberString(fiatBalance) : '0', // TODO: avoid fallback
      fiatConversion: fiatConversion
        ? this.getNumberString(fiatConversion)
        : '0', // TODO: avoid fallback
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
