import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { OctavApi } from '@/datasources/portfolio-api/octav-api.service';
import { IPortfolioApi } from '@/domain/interfaces/portfolio-api.interface';

@Module({
  providers: [HttpErrorFactory, { provide: IPortfolioApi, useClass: OctavApi }],
  exports: [IPortfolioApi],
})
export class PortfolioApiModule {}
