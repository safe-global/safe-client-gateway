import { Inject, Injectable } from '@nestjs/common';
import { IPricesApi } from '../interfaces/prices-api.interface';
import { IPricesRepository } from './prices.repository.interface';
import { AssetPriceValidator } from './asset-price.validator';
import { FiatCodesValidator } from './fiat-codes.validator';
import { AssetPrice } from '@/domain/prices/entities/asset-price.entity';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';

@Injectable()
export class PricesRepository implements IPricesRepository {
  constructor(
    @Inject(IPricesApi) private readonly coingeckoApi: IPricesApi,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    private readonly assetPriceValidator: AssetPriceValidator,
    private readonly fiatCodesValidator: FiatCodesValidator,
  ) {}

  async getNativeCoinPrice(args: {
    nativeCoinId: string;
    fiatCode: string;
  }): Promise<number | null> {
    return this.coingeckoApi.getNativeCoinPrice(args);
  }

  async getTokenPrices(args: {
    chainName: string;
    tokenAddresses: string[];
    fiatCode: string;
  }): Promise<AssetPrice[]> {
    return this.coingeckoApi.getTokenPrices(args);
  }

  async getFiatCodes(): Promise<string[]> {
    return this.coingeckoApi.getFiatCodes();
  }
}
