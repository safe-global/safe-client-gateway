import { Inject, Injectable } from '@nestjs/common';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import { BalancesValidator } from '@/domain/balances/balances.validator';
import { Balance } from '@/domain/balances/entities/balance.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { SimpleBalancesValidator } from '@/domain/balances/simple-balances.validator';
import { SimpleBalance } from '@/domain/balances/entities/simple-balance.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IPricesRepository } from '@/domain/prices/prices.repository.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { getNumberString } from '@/domain/common/utils/utils';

@Injectable()
export class BalancesRepository implements IBalancesRepository {
  private readonly pricesProviderChainIds: string[];

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IPricesRepository)
    private readonly pricesRepository: IPricesRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    private readonly balancesValidator: BalancesValidator,
    private readonly simpleBalancesValidator: SimpleBalancesValidator,
  ) {
    this.pricesProviderChainIds = this.configurationService.getOrThrow<
      string[]
    >('features.pricesProviderChainIds');
  }

  async getBalances(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balance[]> {
    let balances: Balance[];
    if (this.pricesProviderChainIds.includes(args.chainId)) {
      return this._buildFromSimpleBalances(args);
    } else {
      const api = await this.transactionApiManager.getTransactionApi(
        args.chainId,
      );
      balances = await api.getBalances({
        safeAddress: args.safeAddress,
        trusted: args.trusted,
        excludeSpam: args.excludeSpam,
      });
      return balances.map((balance) =>
        this.balancesValidator.validate(balance),
      );
    }
  }

  async clearLocalBalances(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const api = await this.transactionApiManager.getTransactionApi(
      args.chainId,
    );
    await api.clearLocalBalances(args.safeAddress);
  }

  private async _buildFromSimpleBalances(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balance[]> {
    const api = await this.transactionApiManager.getTransactionApi(
      args.chainId,
    );
    const simpleBalances = await api.getSimpleBalances({
      safeAddress: args.safeAddress,
      trusted: args.trusted,
      excludeSpam: args.excludeSpam,
    });
    simpleBalances.map((simpleBalance) =>
      this.simpleBalancesValidator.validate(simpleBalance),
    );

    const tokenAddresses = simpleBalances
      .map((sb) => sb.tokenAddress)
      .filter((a): a is string => a !== null);

    const prices = tokenAddresses.length
      ? await this._getTokenPrices(args.chainId, args.fiatCode, tokenAddresses)
      : [];

    return await Promise.all(
      simpleBalances.map(async (simpleBalance) => {
        const tokenAddress = simpleBalance.tokenAddress?.toLowerCase() ?? null;
        const price =
          tokenAddress === null
            ? await this._getNativeCoinPrice(args.chainId, args.fiatCode)
            : prices.find((i) => i[0] === tokenAddress)?.[1] || null; // TODO: refactor
        const fiatBalance = await this._getFiatBalance(price, simpleBalance);
        return {
          ...simpleBalance,
          fiatBalance: fiatBalance ? getNumberString(fiatBalance) : null,
          fiatConversion: price ? getNumberString(price) : null,
        };
      }),
    );
  }

  private async _getNativeCoinPrice(
    chainId: string,
    fiatCode: string,
  ): Promise<number | null> {
    const nativeCoinId = this.configurationService.getOrThrow<string>(
      `prices.chains.${chainId}.nativeCoin`,
    );
    try {
      return await this.pricesRepository.getNativeCoinPrice({
        nativeCoinId,
        fiatCode,
      });
    } catch (err) {
      this.loggingService.warn({
        type: 'invalid_native_coin_price',
        native_coin_id: nativeCoinId,
        fiat_code: fiatCode,
      });
      return null;
    }
  }

  private async _getTokenPrices(
    chainId: string,
    fiatCode: string,
    tokenAddresses: string[],
  ): Promise<[string, number | null][]> {
    const chainName = this.configurationService.getOrThrow<string>(
      `prices.chains.${chainId}.chainName`,
    );
    try {
      return await this.pricesRepository.getTokenPrices({
        chainName,
        tokenAddresses,
        fiatCode,
      });
    } catch (err) {
      this.loggingService.warn({
        type: 'invalid_token_price',
        token_address: tokenAddresses,
        fiat_code: fiatCode,
      });
      return tokenAddresses.map((a) => [a, null]);
    }
  }

  private _getFiatBalance(
    price: number | null,
    balance: SimpleBalance,
  ): number | null {
    return price !== null
      ? (price * Number(balance.balance)) /
          10 ** (balance.token?.decimals ?? 18)
      : null;
  }
}
