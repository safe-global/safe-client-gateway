import { Inject, Injectable } from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IPricesApi } from '../interfaces/prices-api.interface';
import { IPricesRepository } from './prices.repository.interface';
import { AssetPriceValidator } from './asset-price.validator';
import { FiatCodesValidator } from './fiat-codes.validator';

@Injectable()
export class PricesRepository implements IPricesRepository {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IPricesApi) private readonly coingeckoApi: IPricesApi,
    private readonly assetPriceValidator: AssetPriceValidator,
    private readonly fiatCodesValidator: FiatCodesValidator,
  ) {}

  async getNativeCoinPrice(args: {
    nativeCoinId: string;
    fiatCode: string;
  }): Promise<number> {
    const result = await this.coingeckoApi.getNativeCoinPrice(args);
    const assetPrice = await this.assetPriceValidator.validate(result);
    const { nativeCoinId, fiatCode } = args;
    return assetPrice?.[nativeCoinId]?.[fiatCode];
  }

  async getTokenPrice(args: {
    chainName: string;
    tokenAddress: string;
    fiatCode: string;
  }): Promise<number> {
    const result = await this.coingeckoApi.getTokenPrice(args);
    const assetPrice = await this.assetPriceValidator.validate(result);
    const { tokenAddress, fiatCode } = args;
    return assetPrice?.[tokenAddress.toLowerCase()]?.[fiatCode];
  }

  async getFiatCodes(): Promise<string[]> {
    const result = await this.coingeckoApi.getFiatCodes();
    return this.fiatCodesValidator.validate(result);
  }
}
