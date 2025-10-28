import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IPortfolioApi } from '@/domain/interfaces/portfolio-api.interface';
import { ZerionPortfolioApi } from '@/datasources/portfolio-api/zerion-portfolio-api.service';

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
