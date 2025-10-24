import { Module } from '@nestjs/common';
import { PortfolioController } from '@/routes/portfolio/portfolio.controller';
import { PortfolioService } from '@/routes/portfolio/portfolio.service';
import { PortfolioServiceModule } from '@/domain/portfolio/portfolio.service.interface';

@Module({
  imports: [PortfolioServiceModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
