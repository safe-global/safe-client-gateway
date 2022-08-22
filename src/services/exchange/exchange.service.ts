import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { ExchangeResult } from './entities/exchange.entity';
import { INetworkService, NetworkService } from '../../common/network/network.service.interface';
import { IConfigurationService } from '../../common/config/configuration.service.interface';

@Injectable()
export class ExchangeService {
  // TODO can we depend on the base url instead?
  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    private readonly httpErrorHandler: HttpErrorHandler,
  ) {}

  async convertRates(to: string, from: string): Promise<number> {
    const exchangeResult = await this.getExchangeResult();

    if (exchangeResult.rates === undefined) {
      throw new InternalServerErrorException(`Exchange rates unavailable`);
    }

    const fromExchangeRate = exchangeResult.rates[from.toUpperCase()];
    if (fromExchangeRate === undefined || fromExchangeRate == 0)
      throw new InternalServerErrorException(`Exchange rate for ${from} is not available`);
    const toExchangeRate = exchangeResult.rates[to.toUpperCase()];
    if (toExchangeRate === undefined)
      throw new InternalServerErrorException(`Exchange rate for ${to} is not available`);

    return toExchangeRate / fromExchangeRate;
  }

  private async getExchangeResult(): Promise<ExchangeResult> {
    const baseUrl = this.configurationService.get<string>('exchange.baseUri');
    const apiKey = this.configurationService.get<string>('exchange.apiKey');

    try {
      const { data } = await this.networkService.get(baseUrl, {
        params: { access_key: apiKey },
      });
      return data;
    } catch (error) {
      this.httpErrorHandler.handle(error);
    }
  }
}
