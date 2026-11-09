// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import {
  IZerionWalletPortfolioApi,
  ZerionWalletPortfolioApi,
} from '#/modules/balances/datasources/zerion-wallet-portfolio-api.service';
import { ZerionModule } from '#/modules/zerion/zerion.module';

@Module({
  imports: [ZerionModule],
  providers: [
    HttpErrorFactory,
    { provide: IZerionWalletPortfolioApi, useClass: ZerionWalletPortfolioApi },
  ],
  exports: [IZerionWalletPortfolioApi],
})
export class ZerionWalletPortfolioApiModule {}
