// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { FeeServiceApiService } from '@/datasources/fee-service-api/fee-service-api.service';
import { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';

@Module({
  providers: [
    HttpErrorFactory,
    { provide: IFeeServiceApi, useClass: FeeServiceApiService },
  ],
  exports: [IFeeServiceApi],
})
export class FeeServiceApiModule {}
