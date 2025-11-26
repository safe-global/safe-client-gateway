import { Module } from '@nestjs/common';
import { PortfolioApiModule } from '@/modules/portfolio/datasources/portfolio-api.module';
import { PortfolioRepositoryModule } from '@/modules/portfolio/domain/portfolio.repository.module';
import { PortfolioServiceModule } from '@/modules/portfolio/domain/portfolio.service.interface';
import { PortfolioModule as PortfolioV1Module } from '@/modules/portfolio/v1/portfolio.module';

@Module({
  imports: [
    PortfolioApiModule,
    PortfolioRepositoryModule,
    PortfolioServiceModule,
    PortfolioV1Module,
  ],
})
export class PortfolioModule {}
