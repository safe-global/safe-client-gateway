import { Module } from '@nestjs/common';
import { IPortfolioApi } from '@/domain/interfaces/portfolio-api.interface';
import {
  ZERION_PORTFOLIO_API,
  ZAPPER_PORTFOLIO_API,
} from '@/datasources/portfolio-api/portfolio-api.module';

const portfolioApi = {
  getPortfolio: jest.fn(),
} as jest.MockedObjectDeep<IPortfolioApi>;

const zerionPortfolioApi = {
  getPortfolio: jest.fn(),
} as jest.MockedObjectDeep<IPortfolioApi>;

const zapperPortfolioApi = {
  getPortfolio: jest.fn(),
} as jest.MockedObjectDeep<IPortfolioApi>;

@Module({
  providers: [
    {
      provide: IPortfolioApi,
      useFactory: (): jest.MockedObjectDeep<IPortfolioApi> => {
        return jest.mocked(portfolioApi);
      },
    },
    {
      provide: ZERION_PORTFOLIO_API,
      useFactory: (): jest.MockedObjectDeep<IPortfolioApi> => {
        return jest.mocked(zerionPortfolioApi);
      },
    },
    {
      provide: ZAPPER_PORTFOLIO_API,
      useFactory: (): jest.MockedObjectDeep<IPortfolioApi> => {
        return jest.mocked(zapperPortfolioApi);
      },
    },
  ],
  exports: [IPortfolioApi, ZERION_PORTFOLIO_API, ZAPPER_PORTFOLIO_API],
})
export class TestPortfolioApiModule {}
