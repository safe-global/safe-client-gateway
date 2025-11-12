import { Module } from '@nestjs/common';
import { PortfolioRepository } from '@/modules/portfolio/domain/portfolio.repository';
import { PortfolioApiModule } from '@/modules/portfolio/datasources/portfolio-api.module';
import { IPortfolioRepository } from '@/modules/portfolio/domain/portfolio.repository.interface';

@Module({
  imports: [PortfolioApiModule],
  providers: [
    {
      provide: IPortfolioRepository,
      useClass: PortfolioRepository,
    },
  ],
  exports: [IPortfolioRepository],
})
export class PortfolioRepositoryModule {}
