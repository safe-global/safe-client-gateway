// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { BillingApiModule } from '@/datasources/billing-api/billing-api.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { EntitlementsDomainModule } from '@/modules/entitlements/entitlements-domain.module';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import { SubscriptionSyncService } from '@/modules/entitlements/routes/subscription-sync.service';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { UsersModule } from '@/modules/users/users.module';

/**
 * Routes layer of the entitlements feature. For now this only hosts
 * `SubscriptionSyncService` (consumed by `BillingModule`'s webhook handler);
 * the `GET/PUT /v1/spaces/:spaceId/entitlements` HTTP surface lands in a
 * follow-up PR, which will add `EntitlementsController` and `AuthModule` here.
 *
 * `EntitlementsService` needs `ISpacesRepository`/`ISpaceSafesRepository`
 * (from `SpacesModule`) and `IMembersRepository` (from `UsersModule`) for its
 * quota/grandfathering checks — hence the `forwardRef`s `EntitlementsDomainModule`
 * itself cannot take, since it must stay acyclic (it's a dependency of
 * `SpacesModule`/`UsersModule`); this module sits above that layer and can
 * afford the cycle.
 */
@Module({
  imports: [
    EntitlementsDomainModule,
    PostgresDatabaseModuleV2,
    BillingApiModule,
    forwardRef(() => SpacesModule),
    forwardRef(() => UsersModule),
  ],
  providers: [EntitlementsService, SubscriptionSyncService],
  exports: [SubscriptionSyncService],
})
export class EntitlementsModule {}
