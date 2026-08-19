// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import { SpaceFeatureUsage } from '@/modules/entitlements/datasources/entities/space-feature-usage.entity.db';
import { SpaceSeatSelection } from '@/modules/entitlements/datasources/entities/space-seat-selection.entity.db';
import { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import { SubscriptionEntitlement } from '@/modules/entitlements/datasources/entities/subscription-entitlement.entity.db';
import { FeaturesRepository } from '@/modules/entitlements/domain/features.repository';
import { IFeaturesRepository } from '@/modules/entitlements/domain/features.repository.interface';
import { SubscriptionEntitlementsRepository } from '@/modules/entitlements/domain/subscription-entitlements.repository';
import { ISubscriptionEntitlementsRepository } from '@/modules/entitlements/domain/subscription-entitlements.repository.interface';
import { SubscriptionsRepository } from '@/modules/entitlements/domain/subscriptions.repository';
import { ISubscriptionsRepository } from '@/modules/entitlements/domain/subscriptions.repository.interface';

/**
 * Data-access layer of the entitlements feature: one repository per table,
 * each exposing plain queries. Composition lives in `EntitlementsService`.
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
  ],
  providers: [
    { provide: IFeaturesRepository, useClass: FeaturesRepository },
    { provide: ISubscriptionsRepository, useClass: SubscriptionsRepository },
    {
      provide: ISubscriptionEntitlementsRepository,
      useClass: SubscriptionEntitlementsRepository,
    },
  ],
  exports: [
    IFeaturesRepository,
    ISubscriptionsRepository,
    ISubscriptionEntitlementsRepository,
  ],
})
export class EntitlementsRepositoryModule {}
