// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { MaterializedSubscription } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import { isActiveSubscriptionStatus } from '@/modules/entitlements/domain/entitlements.constants';
import { IFeaturesRepository } from '@/modules/entitlements/domain/features.repository.interface';
import { ISubscriptionEntitlementsRepository } from '@/modules/entitlements/domain/subscription-entitlements.repository.interface';
import { ISubscriptionsRepository } from '@/modules/entitlements/domain/subscriptions.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';

/**
 * Orchestrates the entitlements feature: reads and writes rows through the
 * per-table repositories, and owns the transactions spanning several tables.
 */
@Injectable()
export class EntitlementsService {
  public constructor(
    @Inject(IFeaturesRepository)
    private readonly featuresRepository: IFeaturesRepository,
    @Inject(ISubscriptionsRepository)
    private readonly subscriptionsRepository: ISubscriptionsRepository,
    @Inject(ISubscriptionEntitlementsRepository)
    private readonly subscriptionEntitlementsRepository: ISubscriptionEntitlementsRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  /**
   * Idempotently materializes the upstream subscription state of a workspace:
   * upserts every subscription row by `upstreamSubscriptionId` and replaces
   * the active subscription's entitlement package wholesale, in one
   * transaction.
   */
  public async materialize(args: {
    spaceId: Space['id'];
    subscriptions: Array<MaterializedSubscription>;
  }): Promise<void> {
    await this.assertSpaceExists(args.spaceId);

    const withPackage = args.subscriptions.filter(
      (subscription) => subscription.entitlements !== null,
    );
    if (withPackage.length > 1) {
      throw new Error(
        `materialize() received ${withPackage.length} subscriptions carrying an entitlement package for space ${args.spaceId}; expected at most 1`,
      );
    }

    const features = await this.featuresRepository.getFeatures();
    const featureIdByKey = new Map(
      features.map((feature) => [feature.key, feature.id]),
    );

    // Demotions (e.g. active → canceled) run before promotions so the "one
    // active subscription per space" partial unique index never sees both the
    // outgoing and the incoming subscription active at once.
    const orderedSubscriptions = [...args.subscriptions].sort(
      (left, right) =>
        Number(isActiveSubscriptionStatus(left.status)) -
        Number(isActiveSubscriptionStatus(right.status)),
    );

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      let activeSubscriptionId: number | null = null;
      let activePackage: MaterializedSubscription['entitlements'] = null;

      for (const subscription of orderedSubscriptions) {
        const subscriptionId =
          await this.subscriptionsRepository.upsertSubscription(
            {
              spaceId: args.spaceId,
              upstreamSubscriptionId: subscription.upstreamSubscriptionId,
              values: {
                status: subscription.status,
                planId: subscription.planId,
                planName: subscription.planName,
                currentPeriodStart: subscription.currentPeriodStart,
                currentPeriodEnd: subscription.currentPeriodEnd,
              },
            },
            entityManager,
          );

        if (subscription.entitlements !== null) {
          activeSubscriptionId = subscriptionId;
          activePackage = subscription.entitlements;
        }
      }

      if (activeSubscriptionId !== null && activePackage !== null) {
        // Full replace: reprocessing the same upstream state yields the same
        // rows (idempotent by construction).
        await this.subscriptionEntitlementsRepository.deleteEntitlementsBySubscriptionId(
          activeSubscriptionId,
          entityManager,
        );
        await this.subscriptionEntitlementsRepository.createEntitlements(
          {
            subscriptionId: activeSubscriptionId,
            entitlements: activePackage.flatMap((entitlement) => {
              const featureId = featureIdByKey.get(entitlement.featureKey);
              // Unknown keys are dropped by the parser; guard anyway.
              return featureId === undefined
                ? []
                : [
                    {
                      featureId,
                      enabled: entitlement.enabled,
                      quota: entitlement.quota,
                      value: entitlement.value,
                    },
                  ];
            }),
          },
          entityManager,
        );
      }
    });
  }

  private async assertSpaceExists(spaceId: Space['id']): Promise<void> {
    const space = await this.spacesRepository.findOne({
      where: { id: spaceId },
      select: { id: true },
    });
    if (!space) {
      throw new NotFoundException('Workspace not found.');
    }
  }
}
