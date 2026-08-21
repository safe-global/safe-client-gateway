// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { BillingApiModule } from '@/datasources/billing-api/billing-api.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { EntitlementsRepositoryModule } from '@/modules/entitlements/domain/entitlements-repository.module';
import { ISubscriptionSyncService } from '@/modules/entitlements/domain/subscription-sync.service.interface';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import { SubscriptionSyncService } from '@/modules/entitlements/routes/subscription-sync.service';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { UsersModule } from '@/modules/users/users.module';

/**
 * Service layer of the entitlements feature: `EntitlementsService` and
 * `SubscriptionSyncService` (consumed, via `ISubscriptionSyncService`, by
 * `BillingModule`'s webhook handler). The endpoint lives in
 * `EntitlementsRoutesModule`, which is what `FF_USERS` gates.
 *
 * `EntitlementsService` needs `ISpacesRepository`/`ISpaceSafesRepository`
 * (from `SpacesModule`) and `IMembersRepository` (from `UsersModule`) for
 * `assertMember` — hence the `forwardRef`s `EntitlementsRepositoryModule`
 * itself cannot take, since it must stay acyclic (it's a dependency of
 * `SpacesModule`/`UsersModule`); this module sits above that layer and can
 * afford the cycle.
 */
@Module({
  imports: [
    EntitlementsRepositoryModule,
    PostgresDatabaseModuleV2,
    BillingApiModule,
    forwardRef(() => SpacesModule),
    forwardRef(() => UsersModule),
  ],
  providers: [
    EntitlementsService,
    SubscriptionSyncService,
    { provide: ISubscriptionSyncService, useExisting: SubscriptionSyncService },
  ],
  exports: [EntitlementsService, ISubscriptionSyncService],
})
export class EntitlementsModule {}
