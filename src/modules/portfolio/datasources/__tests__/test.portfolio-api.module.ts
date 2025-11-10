import { Module } from '@nestjs/common';
import { IPortfolioApi } from '@/modules/portfolio/interfaces/portfolio-api.interface';

const portfolioApi = {
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
  ],
  exports: [IPortfolioApi],
})
export class TestPortfolioApiModule {}
