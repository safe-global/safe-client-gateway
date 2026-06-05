// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { IPortfolioApi } from '@/modules/portfolio/interfaces/portfolio-api.interface';

const portfolioApi = {
  getPortfolio: vi.fn(),
} as MockedObject<IPortfolioApi>;

@Module({
  providers: [
    {
      provide: IPortfolioApi,
      useFactory: (): MockedObject<IPortfolioApi> => {
        return vi.mocked(portfolioApi);
      },
    },
  ],
  exports: [IPortfolioApi],
})
export class TestPortfolioApiModule {}
