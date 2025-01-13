import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { OctavGetPortfolioSchema } from '@/datasources/portfolio-api/entities/octav-get-portfolio.entity';
import { IPortfolioApi } from '@/domain/interfaces/portfolio-api.interface';
import { rawify } from '@/validation/entities/raw.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Portfolio } from '@/domain/portfolio/entities/portfolio.entity';

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
      const portfolios = await this.networkService
        .get<Array<Portfolio>>({
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
        })
        .then((res) => {
          return OctavGetPortfolioSchema.parse(res.data).getPortfolio;
        });

      // As we are only fetching the portfolio of one Safe, there will only be one element
      return rawify(portfolios[0]);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
