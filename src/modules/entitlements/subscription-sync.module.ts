// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { BillingApiModule } from '@/datasources/billing-api/billing-api.module';
import { EntitlementsRepositoryModule } from '@/modules/entitlements/domain/entitlements-repository.module';
import { ISubscriptionSyncService } from '@/modules/entitlements/domain/subscription-sync.service.interface';
import { EntitlementsModule } from '@/modules/entitlements/entitlements.module';
import { SubscriptionSyncService } from '@/modules/entitlements/routes/subscription-sync.service';
import { SpacesModule } from '@/modules/spaces/spaces.module';

/**
 * What `BillingModule`'s webhook handler consumes, kept apart from
 * `EntitlementsModule` because it pulls `BillingApiModule`: that client
 * requires the billing service's API token at construction, a secret only
 * environments running the integration hold, so a module gating a plan limit
 * must not depend on it.
 */
@Module({
  imports: [
    EntitlementsModule,
    BillingApiModule,
    EntitlementsRepositoryModule,
    forwardRef(() => SpacesModule),
  ],
  providers: [
    SubscriptionSyncService,
    { provide: ISubscriptionSyncService, useExisting: SubscriptionSyncService },
  ],
  exports: [ISubscriptionSyncService],
})
export class SubscriptionSyncModule {}
