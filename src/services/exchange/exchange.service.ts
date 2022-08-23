import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { ExchangeResult } from './entities/exchange-result.entity';
import {
  INetworkService,
  NetworkService,
} from '../../common/network/network.service.interface';
import { IConfigurationService } from '../../common/config/configuration.service.interface';
import { FiatCodesExchangeResult } from './entities/fiat-codes-result.entity';

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
    const exchangeResult: ExchangeResult = (await this.getExchangeResult(
      'latest',
    )) as ExchangeResult;

    if (exchangeResult.rates === undefined)
      throw new InternalServerErrorException(`Exchange rates unavailable`);

    const fromExchangeRate = exchangeResult.rates[from.toUpperCase()];
    if (fromExchangeRate === undefined || fromExchangeRate == 0)
      throw new InternalServerErrorException(
        `Exchange rate for ${from} is not available`,
      );
    const toExchangeRate = exchangeResult.rates[to.toUpperCase()];
    if (toExchangeRate === undefined)
      throw new InternalServerErrorException(
        `Exchange rate for ${to} is not available`,
      );

    return toExchangeRate / fromExchangeRate;
  }

  async getFiatCodes(): Promise<string[]> {
    const fiatCodesResult: FiatCodesExchangeResult =
      (await this.getExchangeResult('symbols')) as FiatCodesExchangeResult;

    return Object.keys(fiatCodesResult.symbols);
  }

  private async getExchangeResult(
    path?: string,
  ): Promise<ExchangeResult | FiatCodesExchangeResult> {
    const baseUrl = this.configurationService.get<string>('exchange.baseUri');
    const apiKey = this.configurationService.get<string>('exchange.apiKey');
    const url = path ? `${baseUrl}/${path}` : baseUrl;

    try {
      const { data } = await this.networkService.get(url, {
        params: { access_key: apiKey },
      });

      if (!data?.success) {
        throw new InternalServerErrorException(
          'Unsuccessful response from Exchange',
        );
      }

      return data;
    } catch (error) {
      this.httpErrorHandler.handle(error); // TODO: use a different error handler for exchange?
    }
  }
}
