import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { IPortfolioApi } from '@/domain/interfaces/portfolio-api.interface';
import { Portfolio } from '@/domain/portfolio/entities/portfolio.entity';
import { Raw } from '@/validation/entities/raw.entity';

@Injectable()
export class OctavApi implements IPortfolioApi {
  private readonly baseUri: string;
  private readonly apiKey: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUri =
      this.configurationService.getOrThrow<string>('portfolio.baseUri');
    this.apiKey =
      this.configurationService.getOrThrow<string>('portfolio.apiKey');
  }

  async getPortfolio(safeAddress: `0x${string}`): Promise<Raw<Portfolio>> {
    try {
      const url = `${this.baseUri}/api/rest/portfolio`;
      const { data: portfolio } = await this.networkService.get<Portfolio>({
        url,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          params: {
            addresses: safeAddress,
            includeImages: true,
          },
        },
      });
      return portfolio;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
