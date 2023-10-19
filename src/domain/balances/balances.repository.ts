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
    return await Promise.all(
      simpleBalances.map(async (simpleBalance) => {
        const price = await this._getPrice(
          args.chainId,
          args.fiatCode,
          simpleBalance.tokenAddress,
        );
        const fiatBalance = await this._getFiatBalance(price, simpleBalance);
        return {
          ...simpleBalance,
          fiatBalance: fiatBalance ? getNumberString(fiatBalance) : null,
          fiatConversion: price ? getNumberString(price) : null,
        };
      }),
    );
  }

  private async _getPrice(
    chainId: string,
    fiatCode: string,
    tokenAddress: string | null,
  ): Promise<number | null> {
    return tokenAddress === null
      ? this._getNativeCoinPrice(chainId, fiatCode)
      : this._getTokenPrice(chainId, fiatCode, tokenAddress);
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

  private async _getTokenPrice(
    chainId: string,
    fiatCode: string,
    tokenAddress: string,
  ): Promise<number | null> {
    const chainName = this.configurationService.getOrThrow<string>(
      `prices.chains.${chainId}.chainName`,
    );
    try {
      return await this.pricesRepository.getTokenPrice({
        chainName,
        tokenAddress,
        fiatCode,
      });
    } catch (err) {
      this.loggingService.warn({
        type: 'invalid_token_price',
        token_address: tokenAddress,
        fiat_code: fiatCode,
      });
      return null;
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
