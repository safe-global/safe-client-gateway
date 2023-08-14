import { Inject, Injectable } from '@nestjs/common';
import {
  ILoggingService,
  LoggingService,
} from '../../logging/logging.interface';
import { IPricesApi } from '../interfaces/prices-api.interface';
import { IPricesRepository } from './prices.repository.interface';

@Injectable()
export class PricesRepository implements IPricesRepository {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IPricesApi) private readonly pricesApi: IPricesApi,
  ) {}

  async getNativeCoinPrice(args: {
    nativeCoinId: string;
    fiatCode: string;
  }): Promise<number> {
    const result = await this.pricesApi.getNativeCoinPrice(args);
    const { nativeCoinId, fiatCode } = args;
    const nativeCoinPrice = result?.[nativeCoinId]?.[fiatCode];

    if (!nativeCoinPrice) {
      this.loggingService.error(`Error getting ${nativeCoinId} price`);
    }

    return nativeCoinPrice ?? 0;
  }

  async getTokenPrice(args: {
    nativeCoinId: string;
    tokenAddress: string;
    fiatCode: string;
  }): Promise<number> {
    const result = await this.pricesApi.getTokenPrice(args);
    const { tokenAddress, fiatCode } = args;
    const tokenPrice = result?.[tokenAddress.toLowerCase()]?.[fiatCode];

    if (!tokenPrice) {
      this.loggingService.warn(`Error getting ${tokenAddress} price`);
    }

    return tokenPrice ?? 0;
  }
}
