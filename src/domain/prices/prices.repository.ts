import { Inject, Injectable } from '@nestjs/common';
import { IPricesRepository } from './prices.repository.interface';
import { IPricesApi } from '../interfaces/prices-api.interface';

@Injectable()
export class PricesRepository implements IPricesRepository {
  constructor(@Inject(IPricesApi) private readonly pricesApi: IPricesApi) {}

  async getNativeCoinPrice(args: {
    nativeCoinId: string;
    fiatCode: string;
  }): Promise<number> {
    const nativeCoinPrice = await this.pricesApi.getNativeCoinPrice(args);
    // TODO: validate
    return (
      (nativeCoinPrice[args.nativeCoinId] &&
        nativeCoinPrice[args.nativeCoinId][args.fiatCode]) ??
      0
    ); // TODO: don't failback to 0
  }

  async getTokenPrice(args: {
    nativeCoinId: string;
    tokenAddress: string;
    fiatCode: string;
  }): Promise<number> {
    const tokenPrice = await this.pricesApi.getTokenPrice(args);
    // TODO: validate
    return (tokenPrice[0] && tokenPrice[0][0]) ?? 0; // TODO: don't failback to 0
  }
}
