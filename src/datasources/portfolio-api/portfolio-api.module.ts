import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IPortfolioApi } from '@/domain/interfaces/portfolio-api.interface';
import { ZerionPortfolioApi } from '@/datasources/portfolio-api/zerion-portfolio-api.service';
import { ZapperPortfolioApi } from '@/datasources/portfolio-api/zapper-portfolio-api.service';

export const ZERION_PORTFOLIO_API = Symbol('ZerionPortfolioApi');
export const ZAPPER_PORTFOLIO_API = Symbol('ZapperPortfolioApi');

@Module({
  providers: [
    HttpErrorFactory,
    {
      provide: IPortfolioApi,
      useClass: ZerionPortfolioApi,
    },
    {
      provide: ZERION_PORTFOLIO_API,
      useClass: ZerionPortfolioApi,
    },
    {
      provide: ZAPPER_PORTFOLIO_API,
      useClass: ZapperPortfolioApi,
    },
  ],
  exports: [IPortfolioApi, ZERION_PORTFOLIO_API, ZAPPER_PORTFOLIO_API],
})
export class PortfolioApiModule {}
