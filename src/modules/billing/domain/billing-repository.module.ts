// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { BillingApiModule } from '@/datasources/billing-api/billing-api.module';
import { BillingRepository } from '@/modules/billing/domain/billing.repository';
import { IBillingRepository } from '@/modules/billing/domain/billing.repository.interface';

/**
 * The seam every consumer of the billing service goes through, so `IBillingApi`
 * stays inside the datasource layer and its `Raw<T>` returns are parsed in
 * exactly one place.
 */
@Module({
  imports: [BillingApiModule],
  providers: [{ provide: IBillingRepository, useClass: BillingRepository }],
  exports: [IBillingRepository],
})
export class BillingRepositoryModule {}
