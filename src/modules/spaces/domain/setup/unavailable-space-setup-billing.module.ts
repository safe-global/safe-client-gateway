// SPDX-License-Identifier: FSL-1.1-MIT
import { Global, Module } from '@nestjs/common';
import { ISpaceSetupBilling } from '#/modules/spaces/domain/setup/space-setup-billing.interface';
import { UnavailableSpaceSetupBilling } from '#/modules/spaces/domain/setup/unavailable-space-setup-billing.service';

/**
 * `ISpaceSetupBilling` while `FF_BILLING_SERVICE` is off. `AppModule`
 * imports this or `SpaceSetupBillingModule`, never both; global because
 * `SpacesModule`, which injects the token, cannot import either per flag.
 */
@Global()
@Module({
  providers: [
    { provide: ISpaceSetupBilling, useClass: UnavailableSpaceSetupBilling },
  ],
  exports: [ISpaceSetupBilling],
})
export class UnavailableSpaceSetupBillingModule {}
