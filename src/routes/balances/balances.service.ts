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
import { getNumberString } from '@/domain/common/utils/utils';

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

  async getBalances(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
    trusted: boolean;
    excludeSpam: boolean;
  }): Promise<Balances> {
    /**
     * Depending on whether chainId is included in the FF pricesProviderChainIds, the balances
     * fiat amounts should be converted to the fiatCode. The function _getBalancesLegacy
     * uses a 3rd party to do it, but _getBalancesNew don't, as the amounts in fiatCode are
     * already provided by IPricesApi.
     *
     * After the FF pricesProviderChainIds is fully applied to all chains, functions
     * _getBalancesLegacy and _mapBalanceLegacy can be removed as they are no longer needed.
     */
    if (this.pricesProviderChainIds.includes(args.chainId)) {
      return this._getBalancesNew(args);
    } else {
      return this._getBalancesLegacy(args);
    }
  }

  /**
   * @deprecated to be removed after Coingecko prices retrieval is complete.
   */
  private async _getBalancesLegacy(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
    trusted: boolean;
    excludeSpam: boolean;
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
      this._mapBalanceLegacy(balance, usdToFiatRate, nativeCurrency),
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
      fiatTotal: getNumberString(totalFiat),
      items: balances,
    };
  }

  /**
   * @deprecated to be removed after Coingecko prices retrieval is complete.
   */
  private _mapBalanceLegacy(
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
      fiatBalance: getNumberString(fiatBalance),
      fiatConversion: getNumberString(fiatConversion),
    };
  }

  private async _getBalancesNew(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balances> {
    const { chainId } = args;
    const simpleBalances = await this.balancesRepository.getBalances(args);
    const { nativeCurrency } = await this.chainsRepository.getChain(chainId);
    const balances: Balance[] = await Promise.all(
      simpleBalances.map(async (balance) =>
        this._mapBalanceNew(balance, nativeCurrency),
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

  private async _mapBalanceNew(
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
