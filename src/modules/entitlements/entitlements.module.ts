// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { IEntitlementEnforcement } from '@/modules/entitlements/domain/entitlement-enforcement.interface';
import { EntitlementsRepositoryModule } from '@/modules/entitlements/domain/entitlements-repository.module';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import { SafeSeatsGuard } from '@/modules/entitlements/routes/guards/safe-seats.guard';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { UsersModule } from '@/modules/users/users.module';

/**
 * Service layer of the entitlements feature: `EntitlementsService` and the
 * route guards enforcing plan limits, reached from other modules through
 * `IEntitlementEnforcement`. The endpoint lives in `EntitlementsRoutesModule`,
 * which is what `FF_USERS` gates; the webhook-facing sync, which needs the
 * billing service's API client, in `SubscriptionSyncModule`.
 *
 * `EntitlementsService` needs `ISpacesRepository`/`ISpaceSafesRepository` (from
 * `SpacesModule`) and `IMembersRepository` (from `UsersModule`) — hence the
 * `forwardRef`s `EntitlementsRepositoryModule` itself cannot take, since it
 * must stay acyclic (it is a dependency of `SpacesModule`); this module sits
 * above that layer and can afford the cycle.
 */
@Module({
  imports: [
    EntitlementsRepositoryModule,
    PostgresDatabaseModuleV2,
    forwardRef(() => SpacesModule),
    forwardRef(() => UsersModule),
  ],
  providers: [
    EntitlementsService,
    { provide: IEntitlementEnforcement, useExisting: EntitlementsService },
    SafeSeatsGuard,
  ],
  exports: [EntitlementsService, IEntitlementEnforcement, SafeSeatsGuard],
})
export class EntitlementsModule {}
