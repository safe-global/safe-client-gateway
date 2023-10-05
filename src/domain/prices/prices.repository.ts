import { Inject, Injectable } from '@nestjs/common';
import {
  ILoggingService,
  LoggingService,
} from '../../logging/logging.interface';
import { IPricesApi } from '../interfaces/prices-api.interface';
import { IPricesRepository } from './prices.repository.interface';
import { isArray } from 'lodash';

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
    try {
      const result = await this.pricesApi.getNativeCoinPrice(args);
      const { nativeCoinId, fiatCode } = args;
      const nativeCoinPrice = result?.[nativeCoinId]?.[fiatCode];
      if (!nativeCoinPrice) {
        this.loggingService.error(`Got an invalid ${nativeCoinId} price`);
        return 0;
      }
      return nativeCoinPrice;
    } catch (err) {
      this.loggingService.error(err.message);
      return 0;
    }
  }

  async getTokenPrice(args: {
    chainName: string;
    tokenAddress: string;
    fiatCode: string;
  }): Promise<number> {
    try {
      const result = await this.pricesApi.getTokenPrice(args);
      const { tokenAddress, fiatCode } = args;
      const tokenPrice = result?.[tokenAddress.toLowerCase()]?.[fiatCode];
      if (!tokenPrice) {
        this.loggingService.warn(`Got an invalid ${tokenAddress} price`);
        return 0;
      }
      return tokenPrice;
    } catch (err) {
      this.loggingService.error(err.message);
      return 0;
    }
  }

  async getFiatCodes(): Promise<string[]> {
    const fiatCodes = await this.pricesApi.getFiatCodes();
    if (!isArray(fiatCodes)) {
      this.loggingService.error(`Got invalid fiat codes: invalid format`);
    }
    return fiatCodes;
  }
}
