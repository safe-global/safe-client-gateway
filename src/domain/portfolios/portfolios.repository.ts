import { Inject, Injectable } from '@nestjs/common';
import { isArray, isEmpty } from 'lodash';
import { DataSourceError } from '../errors/data-source.error';
import { IPortfoliosApi } from '../interfaces/portfolios-api.interface';
import { Portfolio } from './entities/portfolio.entity';
import { Position } from './entities/position.entity';
import { IPortfoliosRepository } from './portfolios.repository.interface';

@Injectable()
export class PortfoliosRepository implements IPortfoliosRepository {
  constructor(
    @Inject(IPortfoliosApi) private readonly portfoliosApi: IPortfoliosApi,
  ) {}

  async getPositions(args: {
    chainName: string;
    safeAddress: string;
    currency: string;
  }): Promise<Position[]> {
    const positions = await this.portfoliosApi.getPositions(args);
    if (!isArray(positions))
      throw new DataSourceError('Invalid positions coming from Portfolios API');

    return positions;
  }

  async getPortfolio(args: {
    safeAddress: string;
    currency: string;
  }): Promise<Portfolio> {
    const portfolio = await this.portfoliosApi.getPortfolio(args);
    if (isEmpty(portfolio))
      throw new DataSourceError('Invalid portfolio coming from Portfolios API');

    return portfolio;
  }

  async clearPortfolio(args: { safeAddress: string }): Promise<void> {
    await this.portfoliosApi.clearPortfolio(args);
  }
}
