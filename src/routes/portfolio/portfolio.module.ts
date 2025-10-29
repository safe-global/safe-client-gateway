import { Module } from '@nestjs/common';
import { PortfolioController } from '@/routes/portfolio/portfolio.controller';
import { PortfolioService } from '@/routes/portfolio/portfolio.service';
import { PortfolioServiceModule } from '@/domain/portfolio/portfolio.service.interface';
import { ChartsRepositoryModule } from '@/domain/charts/charts.repository.module';

@Module({
  imports: [PortfolioServiceModule, ChartsRepositoryModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
