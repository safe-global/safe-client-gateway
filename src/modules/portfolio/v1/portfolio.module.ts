import { Module } from '@nestjs/common';
import { PortfolioController } from '@/modules/portfolio/v1/portfolio.controller';
import { PortfolioApiService } from '@/modules/portfolio/v1/portfolio.service';
import { PortfolioServiceModule } from '@/modules/portfolio/domain/portfolio.service.interface';
import { PortfolioRouteMapper } from '@/modules/portfolio/v1/portfolio.mapper';

@Module({
  imports: [PortfolioServiceModule],
  controllers: [PortfolioController],
  providers: [PortfolioApiService, PortfolioRouteMapper],
})
export class PortfolioModule {}
