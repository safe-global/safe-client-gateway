import { Module } from '@nestjs/common';
import { PortfolioController } from '@/routes/portfolio/portfolio.controller';
import { PortfolioService } from '@/routes/portfolio/portfolio.service';
import { PortfolioServiceModule } from '@/domain/portfolio/portfolio.service.interface';
import { PortfolioMapper } from '@/routes/portfolio/portfolio.mapper';

@Module({
  imports: [PortfolioServiceModule],
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioMapper],
})
export class PortfolioModule {}
