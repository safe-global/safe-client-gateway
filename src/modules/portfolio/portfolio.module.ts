import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { ZerionPortfolioApi } from '@/modules/portfolio/datasources/zerion-portfolio-api.service';
import { PortfolioRepository } from '@/modules/portfolio/domain/portfolio.repository';
import { IPortfolioRepository } from '@/modules/portfolio/domain/portfolio.repository.interface';
import { PortfolioService } from '@/modules/portfolio/domain/portfolio.service';
import { IPortfolioService } from '@/modules/portfolio/domain/portfolio.service.interface';
import { IPortfolioApi } from '@/modules/portfolio/interfaces/portfolio-api.interface';
import { PortfolioController } from '@/modules/portfolio/v1/portfolio.controller';
import { PortfolioRouteMapper } from '@/modules/portfolio/v1/portfolio.mapper';
import { PortfolioApiService } from '@/modules/portfolio/v1/portfolio.service';
import { ZerionModule } from '@/modules/zerion/zerion.module';
import { ChainsModule } from '../chains/chains.module';

@Module({
  imports: [ChainsModule, ZerionModule],
  controllers: [PortfolioController],
  providers: [
    HttpErrorFactory,
    { provide: IPortfolioApi, useClass: ZerionPortfolioApi },
    {
      provide: IPortfolioRepository,
      useClass: PortfolioRepository,
    },
    {
      provide: IPortfolioService,
      useClass: PortfolioService,
    },
    PortfolioApiService,
    PortfolioRouteMapper,
  ],
  exports: [IPortfolioApi, IPortfolioRepository, IPortfolioService],
})
export class PortfolioModule {}
