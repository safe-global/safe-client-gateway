import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IPortfolioApi } from '@/modules/portfolio/interfaces/portfolio-api.interface';
import { ZerionPortfolioApi } from '@/modules/portfolio/datasources/zerion-portfolio-api.service';

@Module({
  providers: [
    HttpErrorFactory,
    {
      provide: IPortfolioApi,
      useClass: ZerionPortfolioApi,
    },
  ],
  exports: [IPortfolioApi],
})
export class PortfolioApiModule {}
