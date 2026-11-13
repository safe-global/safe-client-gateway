// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { BillingApi } from '#/datasources/billing-api/billing-api.service';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { SafeInternalNetworkModule } from '#/datasources/network/safe-internal.network.module';
import { IBillingApi } from '#/domain/interfaces/billing-api.interface';

@Module({
  imports: [SafeInternalNetworkModule],
  providers: [HttpErrorFactory, { provide: IBillingApi, useClass: BillingApi }],
  exports: [IBillingApi],
})
export class BillingApiModule {}
