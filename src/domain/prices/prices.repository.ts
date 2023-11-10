import { Inject, Injectable } from '@nestjs/common';
import { IPricesApi } from '../interfaces/prices-api.interface';
import { IPricesRepository } from './prices.repository.interface';
import { AssetPriceValidator } from './asset-price.validator';
import { FiatCodesValidator } from './fiat-codes.validator';

@Injectable()
export class PricesRepository implements IPricesRepository {
  constructor(
    @Inject(IPricesApi) private readonly coingeckoApi: IPricesApi,
    private readonly assetPriceValidator: AssetPriceValidator,
    private readonly fiatCodesValidator: FiatCodesValidator,
  ) {}

  async getNativeCoinPrice(args: {
    nativeCoinId: string;
    fiatCode: string;
  }): Promise<number> {
    const lowerCaseFiatCode = args.fiatCode.toLowerCase();
    const result = await this.coingeckoApi.getNativeCoinPrice({
      nativeCoinId: args.nativeCoinId,
      fiatCode: lowerCaseFiatCode,
    });
    const assetPrice = this.assetPriceValidator.validate(result);
    return assetPrice?.[args.nativeCoinId]?.[lowerCaseFiatCode];
  }

  async getTokenPrice(args: {
    chainName: string;
    tokenAddress: string;
    fiatCode: string;
  }): Promise<number> {
    const lowerCaseFiatCode = args.fiatCode.toLowerCase();
    const lowerCaseTokenAddress = args.tokenAddress.toLowerCase();
    const result = await this.coingeckoApi.getTokenPrice({
      chainName: args.chainName,
      tokenAddress: lowerCaseTokenAddress,
      fiatCode: lowerCaseFiatCode,
    });

    const tokenPrice = result?.[lowerCaseTokenAddress]?.[lowerCaseFiatCode];
    if (!tokenPrice) {
      await this.coingeckoApi.registerNotFoundTokenPrice({
        chainName: args.chainName,
        tokenAddress: lowerCaseTokenAddress,
        fiatCode: lowerCaseFiatCode,
      });
    }

    return tokenPrice;
  }

  async getFiatCodes(): Promise<string[]> {
    const result = await this.coingeckoApi.getFiatCodes();
    return this.fiatCodesValidator.validate(result);
  }
}
