import { Inject, Injectable } from '@nestjs/common';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import { Balance as TransactionApiBalance } from '@/domain/balances/entities/balance.entity';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { NativeCurrency } from '@/domain/chains/entities/native.currency.entity';
import { IExchangeRepository } from '@/domain/exchange/exchange.repository.interface';
import { Balance } from '@/routes/balances/entities/balance.entity';
import { Balances } from '@/routes/balances/entities/balances.entity';
import { TokenType } from '@/routes/balances/entities/token-type.entity';
import { Token } from '@/routes/balances/entities/token.entity';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { intersection, orderBy } from 'lodash';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IPricesRepository } from '@/domain/prices/prices.repository.interface';
import { SimpleBalance } from '@/domain/balances/entities/simple-balance.entity';

@Injectable()
export class BalancesService {
  static readonly fromRateCurrencyCode: string = 'USD';
  private readonly pricesProviderChainIds: string[];

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
  ) {
    this.pricesProviderChainIds = this.configurationService.getOrThrow<
      string[]
    >('features.pricesProviderChainIds');
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
    trusted: boolean;
    excludeSpam: boolean;
  }): Promise<Balances> {
    if (this.pricesProviderChainIds.includes(args.chainId)) {
      return this._getFromSimpleBalances(args);
    }

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

  /**
   * @deprecated to be removed after Coingecko prices retrieval is complete.
   */
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

  private async _getFromSimpleBalances(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balances> {
    const { chainId, fiatCode } = args;
    const simpleBalances =
      await this.balancesRepository.getSimpleBalances(args);
    const { nativeCurrency } = await this.chainsRepository.getChain(chainId);
    const balances: Balance[] = await Promise.all(
      simpleBalances.map(async (balance) =>
        this._mapSimpleBalance(balance, chainId, fiatCode, nativeCurrency),
      ),
    );
    const fiatTotal = balances
      .filter((b) => b.fiatBalance !== null)
      .reduce((acc, b) => acc + Number(b.fiatBalance), 0);

    return <Balances>{
      fiatTotal: this.getNumberString(fiatTotal),
      items: orderBy(balances, 'fiatBalance', 'desc'),
    };
  }

  private async _mapSimpleBalance(
    txBalance: SimpleBalance,
    chainId: string,
    fiatCode: string,
    nativeCurrency: NativeCurrency,
  ): Promise<Balance> {
    const tokenAddress = txBalance.tokenAddress;
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

    const fiatConversion = await this._getFiatConversion(
      chainId,
      fiatCode,
      tokenAddress,
    );

    return <Balance>{
      tokenInfo: <Token>{
        type: tokenType,
        address: tokenAddress ?? NULL_ADDRESS,
        ...tokenMetaData,
      },
      balance: txBalance.balance,
      fiatBalance: this._getFiatBalance(fiatConversion, txBalance),
      fiatConversion: this.getNumberString(fiatConversion),
    };
  }

  private async _getFiatConversion(
    chainId: string,
    fiatCode: string,
    tokenAddress: string | null,
  ): Promise<number> {
    if (tokenAddress === null) {
      const nativeCoinId = this.configurationService.getOrThrow<string>(
        `prices.chains.${chainId}.nativeCoin`,
      );
      return this.pricesRepository.getNativeCoinPrice({
        nativeCoinId,
        fiatCode,
      });
    }
    const chainName = this.configurationService.getOrThrow<string>(
      `prices.chains.${chainId}.chainName`,
    );
    return this.pricesRepository.getTokenPrice({
      chainName,
      tokenAddress,
      fiatCode,
    });
  }

  private _getFiatBalance(
    fiatConversion: number,
    txBalance: SimpleBalance,
  ): string {
    const fiatBalance =
      (fiatConversion * Number(txBalance.balance)) /
      10 ** (txBalance.token?.decimals ?? 18);

    return this.getNumberString(fiatBalance);
  }

  /**
   * Gets the list of supported fiat codes.
   * USD and EUR fiat codes are fixed, and should be the first ones in the result list.
   * @returns ordered list of uppercase strings representing the supported fiat codes.
   *
   * TODO: Note: during the prices retrieval migration, this will return the
   * intersection between the exchange and the prices provider supported currencies.
   * When it is finished, just the prices provider will be taken as source.
   */
  async getSupportedFiatCodes(): Promise<string[]> {
    const [exchangeFiatCodes, pricesProviderFiatCodes] = await Promise.all([
      this.exchangeRepository.getFiatCodes(),
      this.pricesRepository.getFiatCodes(),
    ]);

    const fiatCodes = intersection(
      exchangeFiatCodes.map((item) => item.toUpperCase()),
      pricesProviderFiatCodes.map((item) => item.toUpperCase()),
    ).sort();

    return Array.from(new Set(['USD', 'EUR', ...fiatCodes]));
  }
}
