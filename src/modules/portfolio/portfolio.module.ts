import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IPortfolioApi } from '@/modules/portfolio/interfaces/portfolio-api.interface';
import { ZerionPortfolioApi } from '@/modules/portfolio/datasources/zerion-portfolio-api.service';
import { PortfolioRepository } from '@/modules/portfolio/domain/portfolio.repository';
import { IPortfolioRepository } from '@/modules/portfolio/domain/portfolio.repository.interface';
import { PortfolioService } from '@/modules/portfolio/domain/portfolio.service';
import { IPortfolioService } from '@/modules/portfolio/domain/portfolio.service.interface';
import { PortfolioController } from '@/modules/portfolio/v1/portfolio.controller';
import { PortfolioApiService } from '@/modules/portfolio/v1/portfolio.service';
import { PortfolioRouteMapper } from '@/modules/portfolio/v1/portfolio.mapper';
import { ChainsModule } from '../chains/chains.module';
import { ZerionModule } from '@/modules/zerion/zerion.module';

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
  exports: [
    IPortfolioApi,
    IPortfolioRepository,
    IPortfolioService,
  ],
})
export class PortfolioModule {}
