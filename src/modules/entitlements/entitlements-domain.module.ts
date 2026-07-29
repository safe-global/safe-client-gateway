// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingApiModule } from '@/datasources/billing-api/billing-api.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import { SpaceFeatureUsage } from '@/modules/entitlements/datasources/entities/space-feature-usage.entity.db';
import { SpaceSeatSelection } from '@/modules/entitlements/datasources/entities/space-seat-selection.entity.db';
import { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import { SubscriptionEntitlement } from '@/modules/entitlements/datasources/entities/subscription-entitlement.entity.db';
import { EntitlementsRepository } from '@/modules/entitlements/domain/entitlements.repository';
import { IEntitlementsRepository } from '@/modules/entitlements/domain/entitlements.repository.interface';
import { SubscriptionSyncService } from '@/modules/entitlements/domain/subscription-sync.service';

/**
 * Leaf domain module of the entitlements layer, always loaded (SpacesModule
 * and UsersModule need the enforcement primitives regardless of the
 * FF_BILLING_SERVICE flag — enforcement checks the flag at runtime).
 *
 * Deliberately imports no other feature module: spaces/users/billing all
 * import this one, so it must stay acyclic. Space resolution happens via the
 * entity manager directly (entity classes are not Nest providers).
 */
@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([
      Feature,
      SpaceSubscription,
      SubscriptionEntitlement,
      SpaceFeatureUsage,
      SpaceSeatSelection,
    ]),
    BillingApiModule,
  ],
  providers: [
    {
      provide: IEntitlementsRepository,
      useClass: EntitlementsRepository,
    },
    SubscriptionSyncService,
  ],
  exports: [IEntitlementsRepository, SubscriptionSyncService],
})
export class EntitlementsDomainModule {}
