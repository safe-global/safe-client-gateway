import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { rawify, type Raw } from '@/validation/entities/raw.entity';
import type { Chart } from '@/domain/charts/entities/chart.entity';
import { ChartPeriod } from '@/domain/charts/entities/chart.entity';
import { ZerionChartResponseSchema } from '@/datasources/balances-api/entities/zerion-chart.entity';
import { ZodError } from 'zod';

export const IChartApi = Symbol('IChartApi');

export interface IChartApi {
  getChart(args: {
    fungibleId: string;
    period: ChartPeriod;
    currency: string;
  }): Promise<Raw<Chart>>;
}

@Injectable()
export class ZerionChartApi implements IChartApi {
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;
  private readonly fiatCodes: Array<string>;

  constructor(
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.apiKey = this.configurationService.get<string>(
      'balances.providers.zerion.apiKey',
    );
    this.baseUri = this.configurationService.getOrThrow<string>(
      'balances.providers.zerion.baseUri',
    );
    this.fiatCodes = this.configurationService
      .getOrThrow<Array<string>>('balances.providers.zerion.currencies')
      .map((currency) => currency.toUpperCase());
  }

  async getChart(args: {
    fungibleId: string;
    period: ChartPeriod;
    currency: string;
  }): Promise<Raw<Chart>> {
    if (!this.fiatCodes.includes(args.currency.toUpperCase())) {
      throw new DataSourceError(
        `Unsupported currency code: ${args.currency}`,
        400,
      );
    }

    try {
      const url = `${this.baseUri}/v1/fungibles/${args.fungibleId}/charts/${args.period}`;
      const params: Record<string, string> = {
        currency: args.currency.toLowerCase(),
      };

      const networkRequest = {
        headers: { Authorization: `Basic ${this.apiKey}` },
        params,
      };

      const response = await this.networkService
        .get({
          url,
          networkRequest,
        })
        .then(({ data }) => ZerionChartResponseSchema.parse(data));

      // Map Zerion chart to domain chart
      return rawify({
        beginAt: response.data.attributes.begin_at,
        endAt: response.data.attributes.end_at,
        stats: response.data.attributes.stats,
        points: response.data.attributes.points,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }
      throw this.httpErrorFactory.from(error);
    }
  }
}
