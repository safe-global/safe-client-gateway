// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { BalancesModule } from '#/modules/balances/balances.module';
import { ChainsModule } from '#/modules/chains/chains.module';
import { ZerionPortfolioApi } from '#/modules/portfolio/datasources/zerion-portfolio-api.service';
import { PortfolioRepository } from '#/modules/portfolio/domain/portfolio.repository';
import { IPortfolioRepository } from '#/modules/portfolio/domain/portfolio.repository.interface';
import { PortfolioService } from '#/modules/portfolio/domain/portfolio.service';
import { IPortfolioService } from '#/modules/portfolio/domain/portfolio.service.interface';
import { IPortfolioApi } from '#/modules/portfolio/interfaces/portfolio-api.interface';
import { PortfolioSummariesV2Controller } from '#/modules/portfolio/routes/v2/portfolio-summaries.v2.controller';
import { PortfolioSummariesV2Service } from '#/modules/portfolio/routes/v2/portfolio-summaries.v2.service';
import { PortfolioSummaryMapper } from '#/modules/portfolio/routes/v2/portfolio-summary.mapper';
import { PortfolioController } from '#/modules/portfolio/v1/portfolio.controller';
import { PortfolioRouteMapper } from '#/modules/portfolio/v1/portfolio.mapper';
import { PortfolioApiService } from '#/modules/portfolio/v1/portfolio.service';
import { SafeRepositoryModule } from '#/modules/safe/domain/safe.repository.interface';
import { ZerionModule } from '#/modules/zerion/zerion.module';

@Module({
  imports: [ChainsModule, ZerionModule, SafeRepositoryModule, BalancesModule],
  controllers: [PortfolioController, PortfolioSummariesV2Controller],
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
    PortfolioSummariesV2Service,
    PortfolioSummaryMapper,
  ],
  exports: [IPortfolioApi, IPortfolioRepository, IPortfolioService],
})
export class PortfolioModule {}
