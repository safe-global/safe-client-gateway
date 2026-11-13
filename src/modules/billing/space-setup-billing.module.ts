// SPDX-License-Identifier: FSL-1.1-MIT
import { Global, Module } from '@nestjs/common';
import { BillingModule } from '#/modules/billing/billing.module';
import { BillingService } from '#/modules/billing/routes/billing.service';
import { ISpaceSetupBilling } from '#/modules/spaces/domain/setup/space-setup-billing.interface';

/**
 * `ISpaceSetupBilling` while `FF_BILLING_SERVICE` is on, aliased to the one
 * `BillingService` instance. `AppModule` imports this or
 * `UnavailableSpaceSetupBillingModule`, never both; global because
 * `SpacesModule`, which injects the token, cannot import either per flag,
 * and `BillingModule` imports `SpacesModule`.
 */
@Global()
@Module({
  imports: [BillingModule],
  providers: [{ provide: ISpaceSetupBilling, useExisting: BillingService }],
  exports: [ISpaceSetupBilling],
})
export class SpaceSetupBillingModule {}
